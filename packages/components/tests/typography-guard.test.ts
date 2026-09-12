import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, it } from "vitest";

/**
 * Every text size and leading a component sets has to go through
 * `scaleTextClasses`, or the `typography` token reaches part of a document
 * and not the rest, with nothing to say so. A literal that is meant to stay
 * fixed is written as a `className` the caller passes, not here.
 *
 * The check is per quoted literal, not per line: this package writes long
 * one-line JSX, so a line that carries one stepped call could hide a second,
 * unstepped literal beside it, and wrapping a long line must not change the
 * verdict.
 */
const SIZE_OR_LEADING =
  /\b(?:text-(?:xs|sm|base|lg|xl|[2-9]xl|\[[^\]]+\])|leading-(?:none|tight|snug|relaxed|loose|\d[\d.]*|\[[^\]]+\]))\b/u;

/**
 * The one literal allowed to stay fixed: the oversize-keep badge is a
 * preview-only diagnostic that never reaches the PDF, and an arbitrary value
 * has no place on the verified scale to step to.
 */
const EXEMPT = new Set(["pages.tsx:text-[10px]"]);

/** True when the literal starting at `index` is an argument of `scaleTextClasses(`. */
function insideScaleCall(source: string, index: number): boolean {
  let depth = 0;
  for (let i = index - 1; i >= 0; i -= 1) {
    const char = source[i];
    if (char === ")") depth += 1;
    else if (char === "(") {
      if (depth === 0) return /scaleTextClasses\s*$/u.test(source.slice(Math.max(0, i - 24), i));
      depth -= 1;
    }
  }
  return false;
}

it("passes every text size and leading literal in a component through scaleTextClasses", async () => {
  const dir = resolve(import.meta.dirname, "../src/components");
  const offenders: string[] = [];
  for (const file of (await readdir(dir)).filter((name) => name.endsWith(".tsx"))) {
    const source = await readFile(resolve(dir, file), "utf8");
    for (const match of source.matchAll(/"([^"\n]*)"/gu)) {
      const literal = match[1] ?? "";
      const size = SIZE_OR_LEADING.exec(literal);
      if (!size) continue;
      if (EXEMPT.has(`${file}:${size[0]}`)) continue;
      if (insideScaleCall(source, match.index)) continue;
      const line = source.slice(0, match.index).split("\n").length;
      offenders.push(`${file}:${line}: "${literal}"`);
    }
  }
  expect(offenders).toEqual([]);
});
