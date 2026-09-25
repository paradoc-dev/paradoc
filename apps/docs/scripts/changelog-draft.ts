/**
 * Print a scaffold for a new `## [x.y.z]` changelog entry from merged PR titles
 * since the last version tag. Best-effort; run by hand, then hand-edit the
 * result into paradoc/CHANGELOG.md.
 *
 * Usage:
 *   tsx scripts/changelog-draft.ts [next-version]
 */
import { execFileSync, execSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function sh(command: string): string {
  return execSync(command, { encoding: "utf8" }).trim();
}

function lastVersionTag(): string | null {
  try {
    // Most recent v-prefixed tag that looks like a semver release.
    return sh("git describe --tags --abbrev=0 --match 'v[0-9]*' 2>/dev/null") || null;
  } catch {
    return null;
  }
}

export function prTitlesSince(tag: string | null, repositoryRoot = sh("git rev-parse --show-toplevel")): string[] {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  const publicRoot = resolve(repositoryRoot, "paradoc");
  // Squashed PR commits carry the PR title. Restrict the draft to the public subtree.
  const log = execFileSync(
    "git",
    ["log", range, "--no-merges", "--format=%s", "--", publicRoot],
    { cwd: repositoryRoot, encoding: "utf8" },
  ).trim();
  if (!log) return [];
  return log
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function main(): void {
  const nextVersion = process.argv[2] ?? "x.y.z";
  const date = new Date().toISOString().slice(0, 10);
  const tag = lastVersionTag();
  const titles = prTitlesSince(tag);

  const lines: string[] = [];
  lines.push(`## [${nextVersion}] - ${date}`);
  lines.push("");
  lines.push("### Added");
  if (titles.length === 0) {
    lines.push(`- (no commits found since ${tag ?? "start of history"})`);
  } else {
    for (const title of titles) {
      lines.push(`- ${title}`);
    }
  }
  lines.push("");
  lines.push("### Changed");
  lines.push("");
  lines.push("### Removed");
  lines.push("");

  console.log(lines.join("\n"));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
