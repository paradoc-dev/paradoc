import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { type ArchiveEntry, createArchive, readArchive } from "./tar";

/** The Agent Skills discovery index version this distribution follows. */
export const SKILLS_INDEX_SCHEMA = "https://schemas.agentskills.io/discovery/0.2.0/schema.json";
/** Where the distribution is published on each host. */
export const SKILLS_BASE_PATH = "/.well-known/agent-skills";

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

export interface SkillIndexEntry {
  name: string;
  type: "archive";
  description: string;
  url: string;
  digest: string;
}

export interface SkillIndex {
  $schema: string;
  skills: SkillIndexEntry[];
}

export function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function listFiles(root: string, dir = ""): string[] {
  return readdirSync(path.join(root, dir))
    .sort()
    .flatMap((name) => {
      const relative = dir ? `${dir}/${name}` : name;
      return statSync(path.join(root, relative)).isDirectory() ? listFiles(root, relative) : [relative];
    });
}

function frontmatter(skill: string, source: string): { name: string; description: string } {
  const match = /^---\n([\s\S]*?)\n---/.exec(source);
  const data = match ? (parse(match[1] ?? "") as Record<string, unknown>) : null;
  const name = data?.name;
  const description = data?.description;
  if (typeof name !== "string" || typeof description !== "string") {
    throw new Error(`Skill ${skill}: SKILL.md needs a name and a description in its frontmatter`);
  }
  if (name !== skill) throw new Error(`Skill ${skill}: frontmatter name is "${name}"`);
  if (!NAME_PATTERN.test(name) || name.length > 64) throw new Error(`Skill ${skill}: invalid name`);
  const flat = description.replace(/\s+/g, " ").trim();
  if (!flat || flat.length > 1024) throw new Error(`Skill ${skill}: description must be 1 to 1024 characters`);
  return { name, description: flat };
}

/** Relative link targets of a Markdown file, ignoring code and URLs. */
export function relativeLinks(markdown: string): string[] {
  const text = markdown.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
  const targets: string[] = [];
  for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = (match[1] ?? "").split("#")[0] ?? "";
    if (target && !/^[a-z][a-z0-9+.-]*:/i.test(target) && !target.startsWith("/")) targets.push(target);
  }
  return targets;
}

/** Every relative link in a skill's Markdown files must name a file in the skill. */
export function brokenLinks(skill: string, files: ArchiveEntry[]): string[] {
  const known = new Set(files.map((file) => file.path));
  const broken: string[] = [];
  for (const file of files) {
    if (!file.path.endsWith(".md")) continue;
    const base = path.posix.dirname(file.path);
    for (const target of relativeLinks(new TextDecoder().decode(file.content))) {
      const resolved = path.posix.normalize(path.posix.join(base, target));
      if (!known.has(resolved)) broken.push(`${skill}/${file.path} links to missing ${target}`);
    }
  }
  return broken;
}

function readSkill(skillsDir: string, skill: string): { entry: Omit<SkillIndexEntry, "url" | "digest">; files: ArchiveEntry[] } {
  const root = path.join(skillsDir, skill);
  const files = listFiles(root).map((relative) => ({
    path: relative,
    content: readFileSync(path.join(root, relative)),
  }));
  const manifest = files.find((file) => file.path === "SKILL.md");
  if (!manifest) throw new Error(`Skill ${skill}: SKILL.md is missing`);
  const { name, description } = frontmatter(skill, new TextDecoder().decode(manifest.content));
  const broken = brokenLinks(skill, files);
  if (broken.length > 0) throw new Error(`Broken skill references:\n${broken.join("\n")}`);
  return { entry: { name, type: "archive", description }, files };
}

/**
 * Write the Agent Skills distribution for every skill under `skillsDir` into
 * `outDir`: an archive per skill, the unpacked files beside it for progressive
 * disclosure, and the index whose digests are of the archive bytes.
 */
export function writeSkillDistribution(skillsDir: string, outDir: string): SkillIndex {
  const skills = readdirSync(skillsDir)
    .filter((name) => statSync(path.join(skillsDir, name)).isDirectory())
    .sort();
  if (skills.length === 0) throw new Error(`No skills found in ${skillsDir}`);

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const entries: SkillIndexEntry[] = [];

  for (const skill of skills) {
    const { entry, files } = readSkill(skillsDir, skill);
    const archive = createArchive(files);
    writeFileSync(path.join(outDir, `${entry.name}.tar.gz`), archive);
    for (const file of files) {
      const target = path.join(outDir, entry.name, file.path);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, file.content);
    }
    entries.push({
      ...entry,
      url: `${SKILLS_BASE_PATH}/${entry.name}.tar.gz`,
      digest: sha256(archive),
    });
  }

  const index: SkillIndex = { $schema: SKILLS_INDEX_SCHEMA, skills: entries };
  writeFileSync(path.join(outDir, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
  return index;
}

/**
 * Verify a distribution as a consumer would, from bytes only: the index shape,
 * each archive's digest, the archive contents against the unpacked files, and
 * every relative link. `fetchBytes` maps an index-relative URL to its bytes.
 */
export function verifySkillDistribution(fetchBytes: (urlPath: string) => Uint8Array): string[] {
  const problems: string[] = [];
  const index = JSON.parse(new TextDecoder().decode(fetchBytes(`${SKILLS_BASE_PATH}/index.json`))) as SkillIndex;
  if (index.$schema !== SKILLS_INDEX_SCHEMA) problems.push(`Unknown index schema ${String(index.$schema)}`);
  if (!Array.isArray(index.skills) || index.skills.length === 0) problems.push("Index lists no skills");

  for (const skill of index.skills ?? []) {
    const label = skill.name;
    if (!NAME_PATTERN.test(label) || label.length > 64) problems.push(`${label}: invalid name`);
    if (skill.type !== "archive") problems.push(`${label}: unexpected type ${String(skill.type)}`);
    if (!skill.description || skill.description.length > 1024) problems.push(`${label}: invalid description`);
    if (!DIGEST_PATTERN.test(skill.digest)) problems.push(`${label}: malformed digest`);

    const bytes = fetchBytes(skill.url);
    if (sha256(bytes) !== skill.digest) {
      problems.push(`${label}: digest does not match ${skill.url}`);
      continue;
    }
    const files = readArchive(bytes);
    const manifest = files.find((file) => file.path === "SKILL.md");
    if (!manifest) problems.push(`${label}: archive has no SKILL.md at its root`);
    else if (frontmatter(label, new TextDecoder().decode(manifest.content)).description !== skill.description) {
      problems.push(`${label}: index description differs from SKILL.md`);
    }
    problems.push(...brokenLinks(label, files));
    for (const file of files) {
      const served = fetchBytes(`${SKILLS_BASE_PATH}/${label}/${file.path}`);
      if (Buffer.compare(Buffer.from(served), Buffer.from(file.content)) !== 0) {
        problems.push(`${label}: served ${file.path} differs from the archive`);
      }
    }
  }
  return problems;
}
