import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  SKILLS_INDEX_SCHEMA,
  brokenLinks,
  relativeLinks,
  sha256,
  verifySkillDistribution,
  writeSkillDistribution,
} from "../src/skills";
import { createArchive, readArchive } from "../src/tar";

const publicSkills = fileURLToPath(new URL("../../../skills/skills", import.meta.url));
let work: string;

beforeAll(() => {
  work = mkdtempSync(path.join(tmpdir(), "agent-discovery-"));
});
afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

/** Build a distribution and return a reader shaped like an HTTP host. */
function publish(skillsDir: string, name: string) {
  const site = path.join(work, name);
  const index = writeSkillDistribution(skillsDir, path.join(site, ".well-known/agent-skills"));
  const read = (urlPath: string) => readFileSync(path.join(site, urlPath));
  return { site, index, read };
}

function fixtureSkill(name: string, files: Record<string, string>): string {
  const dir = path.join(work, `fixture-${name}`);
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name, file)), { recursive: true });
    writeFileSync(path.join(dir, name, file), content);
  }
  return dir;
}

const manifest = (name: string, body = "See [the guide](./references/guide.md).") =>
  `---\nname: ${name}\ndescription: >\n  A demo\n  skill.\n---\n\n${body}\n`;

describe("the public skills", () => {
  it("publish paradoc and paradoc-react with a valid index", () => {
    const { index, read } = publish(publicSkills, "public");
    expect(index.$schema).toBe(SKILLS_INDEX_SCHEMA);
    expect(index.skills.map((skill) => skill.name)).toEqual(["paradoc", "paradoc-react"]);
    for (const skill of index.skills) {
      expect(skill.digest).toBe(sha256(read(skill.url)));
      expect(skill.description.length).toBeLessThanOrEqual(1024);
    }
    expect(verifySkillDistribution(read)).toEqual([]);
  });

  it("extract in an isolated directory with every reference and no broken link", () => {
    const { index, read } = publish(publicSkills, "isolated");
    for (const skill of index.skills) {
      const target = path.join(work, "consumer", skill.name);
      mkdirSync(target, { recursive: true });
      const archive = path.join(target, "skill.tar.gz");
      writeFileSync(archive, read(skill.url));
      execFileSync("tar", ["-xzf", archive, "-C", target]);
      const files = readArchive(read(skill.url));
      expect(files.map((file) => file.path)).toContain("SKILL.md");
      for (const file of files) {
        expect(readFileSync(path.join(target, file.path))).toEqual(Buffer.from(file.content));
      }
      expect(brokenLinks(skill.name, files)).toEqual([]);
    }
  });

  it("ship every reference the manifest links to", () => {
    const { index, read } = publish(publicSkills, "refs");
    for (const skill of index.skills) {
      const files = readArchive(read(skill.url)).map((file) => file.path);
      const linked = relativeLinks(readFileSync(path.join(publicSkills, skill.name, "SKILL.md"), "utf8"));
      expect(linked.length).toBeGreaterThan(0);
      for (const target of linked) expect(files).toContain(path.posix.normalize(target));
    }
  });
});

describe("verification", () => {
  it("fails on a digest that does not match the delivered bytes", () => {
    const { read } = publish(fixtureSkill("demo", { "SKILL.md": manifest("demo"), "references/guide.md": "# Guide\n" }), "digest");
    const tampered = (urlPath: string) => {
      const bytes = read(urlPath);
      return urlPath.endsWith(".tar.gz") ? Buffer.concat([bytes, Buffer.from([0])]) : bytes;
    };
    expect(verifySkillDistribution(tampered).join("\n")).toContain("digest does not match");
  });

  it("fails when an unpacked file differs from the archive", () => {
    const { site, read } = publish(fixtureSkill("demo2", { "SKILL.md": manifest("demo2"), "references/guide.md": "# Guide\n" }), "drift");
    writeFileSync(path.join(site, ".well-known/agent-skills/demo2/references/guide.md"), "# Changed\n");
    expect(verifySkillDistribution(read).join("\n")).toContain("differs from the archive");
  });

  it("refuses to build a skill with a broken reference", () => {
    const dir = fixtureSkill("broken", { "SKILL.md": manifest("broken") });
    expect(() => writeSkillDistribution(dir, path.join(work, "broken-out"))).toThrow(/missing \.\/references\/guide\.md/);
  });

  it("refuses a skill whose frontmatter name differs from its directory", () => {
    const dir = fixtureSkill("named", { "SKILL.md": manifest("other", "No links."), });
    expect(() => writeSkillDistribution(dir, path.join(work, "named-out"))).toThrow(/frontmatter name/);
  });

  it("ignores links inside code fences and absolute URLs", () => {
    expect(relativeLinks("`[q](./q.md)` ```\n[x](./a.md)\n```\n[y](https://example.com/b.md) [z](#top) [w](./c.md#part)")).toEqual(["./c.md"]);
  });
});

describe("archive reader", () => {
  it("round-trips entries", () => {
    const entries = [{ path: "SKILL.md", content: new TextEncoder().encode("hi") }];
    expect(readArchive(createArchive(entries))).toEqual(entries);
  });

  it("rejects path traversal", () => {
    const archive = createArchive([{ path: "../escape.md", content: new Uint8Array() }]);
    expect(() => readArchive(archive)).toThrow(/escapes the skill directory/);
  });

  it("rejects absolute paths", () => {
    const archive = createArchive([{ path: "/etc/passwd", content: new Uint8Array() }]);
    expect(() => readArchive(archive)).toThrow(/escapes the skill directory/);
  });
});
