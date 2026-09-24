/**
 * The `paradoc-react` skill teaches by example, and an agent copies the
 * classes it sees. A class outside the verified vocabulary in a skill example
 * makes `paradoc check` fail and a PDF render throw for every agent that
 * copied it. This reads every code block in the skill and holds each class it
 * names to `isSupportedClass`.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isSupportedClass } from "../src/tailwind";

const SKILL_DIR = resolve(
  import.meta.dirname,
  "../../../skills/skills/paradoc-react"
);

function skillFiles(): string[] {
  const references = readdirSync(join(SKILL_DIR, "references")).map(
    (name) => `references/${name}`
  );
  return ["SKILL.md", ...references];
}

/** Every class a code block names in `className`, a class helper, or a column `width`. */
function classesInCode(markdown: string): string[] {
  const blocks = [
    ...markdown.matchAll(/```(?:tsx|ts|jsx|js)\n([\s\S]*?)```/g),
  ].map((match) => match[1]!);
  const strings = blocks.flatMap((block) => [
    ...[...block.matchAll(/className="([^"]*)"/g)].map((m) => m[1]!),
    ...[...block.matchAll(/className=\{`([^`]*)`\}/g)].map((m) =>
      m[1]!.replace(/\$\{[^}]*\}/g, "")
    ),
    ...[
      ...block.matchAll(/(?:scaleTextClasses|flowGapClasses)\("([^"]*)"/g),
    ].map((m) => m[1]!),
    ...[...block.matchAll(/width: "([^"]*)"/g)].map((m) => m[1]!),
  ]);
  return strings.flatMap((value) => value.split(/\s+/).filter(Boolean));
}

describe("paradoc-react skill examples", () => {
  const examples = skillFiles().map((file) => ({
    file,
    classes: classesInCode(readFileSync(join(SKILL_DIR, file), "utf8")),
  }));

  it("finds classes in the examples", () => {
    const total = examples.reduce((sum, e) => sum + e.classes.length, 0);
    expect(total).toBeGreaterThan(20);
  });

  it("uses only classes in the verified vocabulary", () => {
    const refused = examples.flatMap(({ file, classes }) =>
      classes.filter((c) => !isSupportedClass(c)).map((c) => `${file}: ${c}`)
    );
    expect(refused).toEqual([]);
  });

  it("catches a refused class in a code block", () => {
    const markdown =
      '```tsx\n<QRCode className="place-self-end p-2" value="x" />\n```';
    const classes = classesInCode(markdown);
    expect(classes).toEqual(["place-self-end", "p-2"]);
    expect(classes.filter((c) => !isSupportedClass(c))).toEqual([
      "place-self-end",
    ]);
  });
});
