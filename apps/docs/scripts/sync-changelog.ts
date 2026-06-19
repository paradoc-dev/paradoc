/**
 * Sync the canonical paradoc/CHANGELOG.md into the docs content tree as an
 * MDX page so it renders at /changelog. Runs in `prebuild` / `predev`.
 *
 * The canonical changelog is the single source of truth and is NOT shipped
 * inside any npm package; this copy is generated, not authored.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// scripts/ -> apps/docs/ -> apps/ -> paradoc/
const SOURCE = resolve(here, "../../../CHANGELOG.md");
const TARGET = resolve(here, "../content/docs/changelog.mdx");

/** Pull the first `## [x.y.z]` version from a Keep-a-Changelog document. */
export function latestVersion(markdown: string): string | null {
  const match = markdown.match(/^##\s*\[(\d+\.\d+\.\d+)\]/m);
  return match ? match[1] : null;
}

function escapeYaml(value: string): string {
  return value.replace(/"/g, '\\"');
}

function buildPage(markdown: string): string {
  const version = latestVersion(markdown);
  const ogTitle = "Changelog";
  const description = version ? `Release v${version}` : "Paradoc changelog";

  // Drop the leading `# Changelog` H1; fumadocs renders the title from
  // frontmatter, so a second H1 in the body would duplicate it.
  const body = markdown.replace(/^#\s+Changelog\s*\n+/, "");

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

function main(): void {
  const markdown = readFileSync(SOURCE, "utf8");
  const page = buildPage(markdown);
  mkdirSync(dirname(TARGET), { recursive: true });
  writeFileSync(TARGET, page, "utf8");
  const version = latestVersion(markdown) ?? "unknown";
  console.log(`[sync-changelog] wrote ${TARGET} (latest v${version})`);
}

main();
