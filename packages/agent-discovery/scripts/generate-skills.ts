/**
 * Generate the Agent Skills distribution for a host and verify it.
 *
 *   tsx scripts/generate-skills.ts <skillsDir> <outDir>
 *
 * Run by each host's build. Exits non-zero when a skill has broken references
 * or the written distribution fails verification.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { verifySkillDistribution, writeSkillDistribution } from "../src/skills";

const [skillsDir, outDir] = process.argv.slice(2);
if (!skillsDir || !outDir) {
  console.error("Usage: generate-skills <skillsDir> <outDir>");
  process.exit(2);
}

const root = path.resolve(outDir, "..", "..");
const index = writeSkillDistribution(path.resolve(skillsDir), path.resolve(outDir));
const problems = verifySkillDistribution((urlPath) => readFileSync(path.join(root, urlPath)));
if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`Wrote ${index.skills.length} skills to ${outDir}`);
