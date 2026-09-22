/**
 * `src/pdf/tailwind.ts` and the skill's `safe-classes.md` describe the same
 * vocabulary from two sides: one is what the engine was proved to honour, the
 * other is what an author reads before writing a class. They drift apart
 * silently — a family added to one and forgotten in the other is invisible
 * until someone compares them by hand. This compares them by family name,
 * case-insensitively, so a rename or a new family on either side fails here
 * instead of in a support question.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SUPPORTED_CLASS_FAMILIES } from "../src/pdf/tailwind";

const SAFE_CLASSES_PATH = resolve(
  import.meta.dirname,
  "../../../skills/skills/compose-documents/references/safe-classes.md"
);

/** Every family name in the "The verified families" table's first column. */
function familyNamesInSkill(): string[] {
  const content = readFileSync(SAFE_CLASSES_PATH, "utf8");
  const start = content.indexOf("## The verified families");
  if (start === -1) {
    throw new Error(
      `${SAFE_CLASSES_PATH} has no "## The verified families" heading; ` +
        "has the section been renamed?"
    );
  }
  const end = content.indexOf("\n## ", start + 1);
  const section = content.slice(start, end === -1 ? undefined : end);

  const names: string[] = [];
  for (const line of section.split("\n")) {
    const match = /^\|\s*([^|]+?)\s*\|/.exec(line);
    if (match === null) continue;
    const name = match[1]!;
    if (name === "Family" || /^-+$/.test(name)) continue;
    names.push(name);
  }
  return names;
}

describe("the verified vocabulary and the skill's family table agree", () => {
  const codeNames = SUPPORTED_CLASS_FAMILIES.map((family) => family.name.toLowerCase()).sort();
  const skillNames = familyNamesInSkill()
    .map((name) => name.toLowerCase())
    .sort();

  it("has a skill table row for every family in tailwind.ts", () => {
    const missing = codeNames.filter((name) => !skillNames.includes(name));
    expect(missing, `add a row to safe-classes.md's family table for: ${missing.join(", ")}`).toEqual([]);
  });

  it("has a tailwind.ts family for every row in the skill's table", () => {
    const extra = skillNames.filter((name) => !codeNames.includes(name));
    expect(
      extra,
      `safe-classes.md names a family tailwind.ts does not: ${extra.join(", ")}`
    ).toEqual([]);
  });

  it("lists the same number of families on both sides", () => {
    expect(
      skillNames.length,
      `tailwind.ts has ${codeNames.length} families, safe-classes.md's table has ${skillNames.length} rows — a duplicate name on one side would pass the two set comparisons above but not this count`
    ).toBe(codeNames.length);
  });
});
