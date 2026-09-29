/**
 * Sync the canonical paradoc/CHANGELOG.md into the docs content tree as an
 * MDX page so it renders at /changelog. Runs in `prebuild` / `predev`.
 *
 * The canonical changelog is the single source of truth and is NOT shipped
 * inside any npm package; this copy is generated, not authored.
 */
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// scripts/ -> apps/docs/ -> apps/ -> paradoc/
const SOURCE = resolve(here, "../../../CHANGELOG.md");
const TARGET_DIR = resolve(here, "../content/docs/changelog");
const INDEX_TARGET = resolve(TARGET_DIR, "index.mdx");

export interface ReleaseSection {
  version: string;
  date: string;
  body: string;
}

/** Extract released versions, newest first, from a Keep-a-Changelog document. */
export function releaseSections(markdown: string): ReleaseSection[] {
  const heading =
    /^##[ \t]*\[(\d+\.\d+\.\d+)\][ \t]*-[ \t]*(\d{4}-\d{2}-\d{2})[ \t]*$/gm;
  const matches = [...markdown.matchAll(heading)];

  return matches.map((match, index) => ({
    version: match[1],
    date: match[2],
    body: markdown
      .slice(
        (match.index ?? 0) + match[0].length,
        matches[index + 1]?.index ?? markdown.length,
      )
      .trim(),
  }));
}

function escapeYaml(value: string): string {
  return value.replace(/"/g, '\\"');
}

function escapeMdxProse(markdown: string): string {
  let fenced = false;
  return markdown.split("\n").map((line) => {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      return line;
    }
    if (fenced) return line;

    return line.split(/(`[^`]*`)/g).map((part, index) => {
      if (index % 2 === 1) return part;
      return part.replace(/</g, "&lt;").replace(/\{/g, "&#123;").replace(/\}/g, "&#125;");
    }).join("");
  }).join("\n");
}

export function buildPage(markdown: string): string {
  const ogTitle = "Changelog";
  const description = "Product updates and release notes";

  // Drop the leading `# Changelog` H1; fumadocs renders the title from
  // frontmatter, so a second H1 in the body would duplicate it. Release
  // headings link to their permanent pages while this page keeps the full
  // history in one place.
  const body = escapeMdxProse(
    markdown
      .replace(/^#\s+Changelog\s*\n+/, "")
      .replace(
        /^##[ \t]*\[(\d+\.\d+\.\d+)\]([ \t]*-[ \t]*\d{4}-\d{2}-\d{2})[ \t]*$/gm,
        "## [$1](/changelog/v$1)$2",
      ),
  );

  const frontmatter = [
    "---",
    'title: "Changelog"',
    `description: "${escapeYaml(description)}"`,
    `ogTitle: "${escapeYaml(ogTitle)}"`,
    `ogDescription: "${escapeYaml(description)}"`,
    "---",
    "",
    "{/* GENERATED FILE. Edit paradoc/CHANGELOG.md and run `pnpm sync:changelog`. */}",
    "",
  ].join("\n");

  return `${frontmatter}\n${body.trimEnd()}\n`;
}

/**
 * Raise every heading one level outside code fences. A release's sections sit
 * under its `##` version heading in CHANGELOG.md; on the release's own page
 * the version is the title, so its sections become the page's `##` headings.
 */
export function promoteHeadings(markdown: string): string {
  let fenced = false;
  return markdown.split("\n").map((line) => {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      return line;
    }
    return fenced ? line : line.replace(/^#(#{2,6}[ \t])/, "$1");
  }).join("\n");
}

export function buildReleasePage(release: ReleaseSection): string {
  const title = `Paradoc v${release.version}`;
  const description = `Released ${release.date}`;
  const ogDescription = `Release notes for Paradoc v${release.version}`;
  const body = escapeMdxProse(promoteHeadings(release.body));

  const frontmatter = [
    "---",
    `title: "${escapeYaml(title)}"`,
    `description: "${escapeYaml(description)}"`,
    `ogTitle: "${escapeYaml(title)}"`,
    `ogDescription: "${escapeYaml(ogDescription)}"`,
    "---",
    "",
    "{/* GENERATED FILE. Edit paradoc/CHANGELOG.md and run `pnpm sync:changelog`. */}",
    "",
  ].join("\n");

  return `${frontmatter}\n${body.trimEnd()}\n`;
}

function main(): void {
  const markdown = readFileSync(SOURCE, "utf8");
  const releases = releaseSections(markdown);
  mkdirSync(TARGET_DIR, { recursive: true });
  writeFileSync(INDEX_TARGET, buildPage(markdown), "utf8");

  const releaseFiles = new Set<string>();
  for (const release of releases) {
    const filename = `v${release.version}.mdx`;
    releaseFiles.add(filename);
    writeFileSync(resolve(TARGET_DIR, filename), buildReleasePage(release), "utf8");
  }

  for (const filename of readdirSync(TARGET_DIR)) {
    if (/^v\d+\.\d+\.\d+\.mdx$/.test(filename) && !releaseFiles.has(filename)) {
      unlinkSync(resolve(TARGET_DIR, filename));
    }
  }

  const version = releases[0]?.version ?? "unknown";
  console.log(
    `[sync-changelog] wrote ${INDEX_TARGET} and ${releases.length} release pages (latest v${version})`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
