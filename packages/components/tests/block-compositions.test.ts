import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The shipped examples are the acid test of the component vocabulary: a
 * developer who reads one should see components, not the workarounds the
 * components replaced. So a block composition may not size its own text, route
 * its own sizes through the token helpers, wrap its own title in a bare keep,
 * or build a list out of markup. Each of those has a component now: `Text` for
 * a masthead or a heading, `Party` and `Field` for values, `List` for clauses.
 *
 * The scan reads the sources rather than the rendered markup, because the
 * components themselves emit sized classes on purpose: what is retired is a
 * composition writing them by hand.
 *
 * A small explicit exception set demonstrates the lower-level primitives or
 * CSS controls themselves. Those files are still scanned and must continue to
 * contain the pattern that justifies their exception.
 */

/** A text size or a leading, the same family `typography-guard.test.ts` holds components to. */
const SIZE_OR_LEADING =
  /\b(?:text-(?:xs|sm|base|lg|xl|[2-9]xl|\[[^\]]+\])|leading-(?:none|tight|snug|relaxed|loose|\d[\d.]*|\[[^\]]+\]))\b/u;

/** The wrappers a composition used before the components owned the job, each with what replaced it. */
const RETIRED: readonly { name: string; pattern: RegExp }[] = [
  { name: "scaleTextClasses (size text through Text, Field or Party)", pattern: /\bscaleTextClasses\s*\(/u },
  { name: "flowGapClasses (let Field paragraphs and List own their rhythm)", pattern: /\bflowGapClasses\s*\(/u },
  { name: "KeepTogether (a title is a Text heading)", pattern: /<KeepTogether\b/u },
  { name: "raw list markup (use List)", pattern: /<(?:ol|ul|li)\b/u },
  { name: "list-style classes (use List)", pattern: /\blist-(?:decimal|disc|roman|alpha|inside|outside)\b/u },
];

/** Every retired pattern in `source`, as `<line>: <what>`. */
function retiredMarkup(source: string): string[] {
  const found: string[] = [];
  const lineOf = (index: number) => source.slice(0, index).split("\n").length;
  // Every string form a class list can take: double-quoted, single-quoted,
  // and template literals, which may span lines.
  for (const match of source.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/gu)) {
    const size = SIZE_OR_LEADING.exec(match[1] ?? match[2] ?? match[3] ?? "");
    if (size) found.push(`${lineOf(match.index)}: hand-sized class "${size[0]}"`);
  }
  for (const { name, pattern } of RETIRED) {
    const global = new RegExp(pattern.source, "gu");
    for (const match of source.matchAll(global)) found.push(`${lineOf(match.index)}: ${name}`);
  }
  return found;
}

/** Demos whose purpose is to expose the lower-level primitive or explicit CSS named here. */
const DOCUMENTED_EXCEPTIONS = new Set([
  "document-variant-custom-layout.tsx",
  "keep-together-demo.tsx",
  "keep-together-variant-custom-element.tsx",
  "keep-together-variant-default-element.tsx",
  "keep-together-variant-passthrough-attributes.tsx",
  "page-break-demo.tsx",
  "page-break-variant-inside-a-tables-rows.tsx",
  "pages-variant-draft-watermark.tsx",
  "pages-variant-page-count.tsx",
  "pages-variant-page-furniture.tsx",
  "proposal-document.tsx",
  "proposal-furniture.tsx",
  "vendor-packet-block-preview.tsx",
]);

const EXAMPLES = (await readdir(resolve(import.meta.dirname, "../src/examples")))
  .filter((path) => path.endsWith(".tsx"))
  .sort();

describe("the example compositions", () => {
  it("scans every TSX source in src/examples", () => {
    expect(EXAMPLES).toContain("arabic-letter-document.tsx");
    expect(EXAMPLES).toContain("insurance-certificate.tsx");
    expect(EXAMPLES.length).toBeGreaterThan(40);
  });

  it.each(EXAMPLES)("%s has only documented retired markup", async (path) => {
    const source = await readFile(resolve(import.meta.dirname, "../src/examples", path), "utf8");
    const findings = retiredMarkup(source);
    if (DOCUMENTED_EXCEPTIONS.has(path)) expect(findings.length).toBeGreaterThan(0);
    else expect(findings).toEqual([]);
  });
});

describe("the scan", () => {
  it("names a hand-sized class wherever it sits in a class list", () => {
    expect(retiredMarkup('<Field className="flex text-sm text-neutral-700" />')).toEqual([
      '1: hand-sized class "text-sm"',
    ]);
    expect(retiredMarkup('<span className="leading-relaxed" />')).toEqual(['1: hand-sized class "leading-relaxed"']);
    expect(retiredMarkup("<span className='text-lg' />")).toEqual(['1: hand-sized class "text-lg"']);
    expect(retiredMarkup("<span className={`flex ${tone} text-xs`} />")).toEqual(['1: hand-sized class "text-xs"']);
  });

  it("names every retired wrapper", () => {
    const source = [
      'const type = (c: string) => scaleTextClasses(c, typography.scale);',
      "const prose = flowGapClasses(type(base), typography.flow);",
      '<KeepTogether as="span" keepId="title">{title}</KeepTogether>',
      "<ol><li>One</li></ol>",
      '<div className="list-decimal" />',
    ].join("\n");
    expect(retiredMarkup(source)).toEqual([
      "1: scaleTextClasses (size text through Text, Field or Party)",
      "2: flowGapClasses (let Field paragraphs and List own their rhythm)",
      "3: KeepTogether (a title is a Text heading)",
      "4: raw list markup (use List)",
      "4: raw list markup (use List)",
      "5: list-style classes (use List)",
    ]);
  });

  it("passes colour, weight and layout classes, which set no size", () => {
    expect(
      retiredMarkup('<Party role="customer" className="flex flex-col gap-0.5 font-medium text-neutral-600" />')
    ).toEqual([]);
  });
});
