import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { REGISTRY_ITEMS } from "../scripts/registry/manifest";

/**
 * The shipped blocks are the acid test of the component vocabulary: a
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
 * The proposal is not a block and is not scanned: it is the sample the
 * recorded preview plan was measured on, and one of its sections keeps its own
 * line pitch until that plan is measured again.
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

/** The compositions the registry ships as blocks, read from the manifest so a new block is scanned without being listed here. */
const COMPOSITIONS = REGISTRY_ITEMS.filter((item) => item.type === "registry:block").flatMap((item) =>
  item.files.filter((file) => file.path.endsWith("-document.tsx")).map((file) => file.path)
);

describe("the block compositions", () => {
  it("scans every block the registry ships", () => {
    expect(COMPOSITIONS).toEqual([
      "examples/purchase-order-document.tsx",
      "examples/invoice-document.tsx",
      "examples/engagement-letter-document.tsx",
      "examples/vendor-packet-document.tsx",
    ]);
  });

  it.each(COMPOSITIONS)("%s composes components, not hand-sized markup", async (path) => {
    const source = await readFile(resolve(import.meta.dirname, "../src", path), "utf8");
    expect(retiredMarkup(source)).toEqual([]);
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
