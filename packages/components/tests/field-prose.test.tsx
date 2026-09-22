/**
 * What a field promises about long prose, checked on both outputs.
 *
 * Two claims, and they are about different things. That a **newline** inside a
 * value is a line break and nothing else: it wraps the text in the preview and
 * in the PDF, and it never decides a page. And that a **blank line** is where
 * `paragraphs` breaks the value into pagination units, so prose long enough to
 * pass a page breaks between its paragraphs rather than overflowing the page as
 * one oversize keep.
 *
 * The pagination claim is checked the way the list's is in `prose.test.tsx`: a
 * plan built from the resolved tree with invented heights, handed to the
 * render, so the breaks asserted on the page are the preview's own and the
 * pages are the engine's.
 *
 * The line-break claim is checked on the PDF's text layer rather than on the
 * markup, because the markup can only show the class. An engine that ignored
 * `whitespace-pre-line` would collapse the newline to a space and draw one
 * line, so the two halves would reach the text layer with a space between
 * them; drawn on two lines they are two runs and reach it with none.
 */

import { fromJsx } from "@takumi-rs/helpers/jsx";
import {
  PageContextProvider,
  planPages,
  type MeasuredKeep,
  type PageContextValue,
} from "@paradoc/react";
import { renderPdf } from "@paradoc/react-pdf";
import { checkElement } from "@paradoc/react-pdf/check";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";

import { Document } from "../src";
// By module path, not through the package index: the rule and the splitter are
// the component's own, the way `SIGNATURE_RULE` is `signature.tsx`'s.
import { Field, FIELD_RULE, fieldParagraphs } from "../src/components/field";
import { proposalForm } from "../src/examples/proposal";
import { shortProposalData } from "../src/examples/proposal-data";
import { readPdf, type ReadPage } from "./pdf-reader";
import { treeKeeps } from "./tree-keeps";

type Tokens = Parameters<typeof Document>[0]["tokens"];
type Format = Parameters<typeof Document>[0]["format"];

/** The sample with one field's value replaced, which is how a filler's prose arrives. */
function withTerms(terms: unknown) {
  return { ...shortProposalData, fields: { ...shortProposalData.fields, terms } };
}

function inDocument(children: React.ReactNode, terms: unknown, tokens?: Tokens, format?: Format) {
  return (
    <Document artifact={proposalForm} data={withTerms(terms)} tokens={tokens} format={format} id="field-prose">
      {children}
    </Document>
  );
}

/** `children` as one page of a plan would see them: only `keeps` are on it. */
function onPage(children: React.ReactNode, keeps: readonly string[]) {
  const value = {
    plan: planPages([], 1000),
    index: 0,
    keeps: new Set(keeps),
    repeats: new Set<string>(),
    sections: new Set<string>(),
  } satisfies PageContextValue;
  return <PageContextProvider value={value}>{children}</PageContextProvider>;
}

/** Three paragraphs, separated by blank lines, each recognisable on a page. */
const THREE = [
  "Payment is due thirty days from the date of the invoice.",
  "Work begins once both parties have signed this proposal.",
  "Either party may end the engagement on fourteen days notice.",
].join("\n\n");

describe("splitting a value into paragraphs", () => {
  it("splits at a blank line, whatever the blank line is made of", () => {
    expect(fieldParagraphs("One\n\nTwo")).toEqual(["One", "Two"]);
    expect(fieldParagraphs("One\n   \nTwo")).toEqual(["One", "Two"]);
    expect(fieldParagraphs("One\n\n\n\nTwo")).toEqual(["One", "Two"]);
    // Prose pasted out of a Windows editor: the blank line is two `\r\n`, and
    // a pattern that only knew `\n` would leave the whole value as one keep.
    expect(fieldParagraphs("One\r\n\r\nTwo")).toEqual(["One", "Two"]);
  });

  it("keeps a single newline inside its paragraph, because a newline is a line break", () => {
    expect(fieldParagraphs("Line one\nLine two")).toEqual(["Line one\nLine two"]);
  });

  it("never returns nothing, so a field of blank lines still prints", () => {
    // A field that vanished would take its label with it and leave the plan a
    // keep short of the tree it measured.
    expect(fieldParagraphs("\n\n")).toEqual(["\n\n"]);
    expect(fieldParagraphs("")).toEqual([""]);
  });
});

describe("Field paragraphs", () => {
  it("gives each paragraph its own keep and keeps the label with the first", () => {
    const html = renderToStaticMarkup(inDocument(<Field path="terms" paragraphs />, THREE));
    expect(html).toContain('data-keep-id="field:terms:0"');
    expect(html).toContain('data-keep-id="field:terms:1"');
    expect(html).toContain('data-keep-id="field:terms:2"');
    // The label is inside the first keep, and nowhere else: a heading on the
    // page above its own words is what a keep exists to prevent.
    expect(html.split('data-keep-id="field:terms:0"')[1]?.split('data-keep-id="field:terms:1"')[0])
      .toContain("Terms");
    expect(html.split('data-keep-id="field:terms:1"')[1]).not.toContain("Terms");
  });

  it("leaves a value with no blank line as one paragraph", () => {
    const html = renderToStaticMarkup(inDocument(<Field path="terms" paragraphs />, "Line one\nLine two"));
    expect(html).toContain('data-keep-id="field:terms:0"');
    expect(html).not.toContain('data-keep-id="field:terms:1"');
    // The newline is still in the text, and the class that draws it is there.
    expect(html).toContain("Line one\nLine two");
    expect(html).toContain("whitespace-pre-line");
  });

  it("is one keep without the prop, whatever blank lines the value has", () => {
    // The unhappy path for the variant: a paragraphed value that nobody asked
    // to paragraph is the single keep it has always been, and is oversize when
    // it outgrows a page.
    const html = renderToStaticMarkup(inDocument(<Field path="terms" />, THREE));
    expect(html).toContain('data-keep-id="field:terms"');
    expect(html).not.toContain('data-keep-id="field:terms:0"');
  });

  it("steps the gap between paragraphs with the document's flow", () => {
    const roomy = renderToStaticMarkup(
      inDocument(<Field path="terms" paragraphs />, THREE, { typography: { flow: "roomy" } })
    );
    expect(roomy).toContain('class="flex flex-col gap-5" data-field-path="terms"');
    const compact = renderToStaticMarkup(
      inDocument(<Field path="terms" paragraphs />, THREE, { typography: { flow: "compact" } })
    );
    // Never `gap-0`: compact paragraphs still read as paragraphs.
    expect(compact).toContain('class="flex flex-col gap-1" data-field-path="terms"');
  });

  it("lets an explicit className replace the wrapper's layout", () => {
    const html = renderToStaticMarkup(
      inDocument(<Field path="terms" paragraphs className="flex flex-col gap-8" />, THREE)
    );
    expect(html).toContain('class="flex flex-col gap-8" data-field-path="terms"');
  });

  it("withdraws from a page holding none of its paragraphs", () => {
    // An empty flex child still takes its section's gap, so a wrapper that
    // stayed on a page with nothing of its own would make the drawn page taller
    // than the flow the plan was measured against.
    const field = <Field path="terms" paragraphs />;
    const first = renderToStaticMarkup(inDocument(onPage(field, ["field:terms:0"]), THREE));
    expect(first).toContain('data-field-path="terms"');
    expect(first).toContain("Payment is due thirty days");
    expect(first).not.toContain("Either party may end");

    const none = renderToStaticMarkup(inDocument(onPage(field, ["elsewhere"]), THREE));
    expect(none).not.toContain('data-field-path="terms"');
    expect(none).not.toContain("Payment is due thirty days");
  });
});

describe("Field rule", () => {
  it("draws a fill line where the artifact has no value", () => {
    const html = renderToStaticMarkup(
      inDocument(<Field path="terms" rule />, undefined, undefined, { partial: true })
    );
    expect(html).toContain(FIELD_RULE);
    expect(html).not.toContain("—");
  });

  it("prints the value when there is one, and the blank placeholder without the prop", () => {
    // Both unhappy paths at once: a rule that swallowed a real value, and a
    // blank that drew a rule nobody asked for.
    const answered = renderToStaticMarkup(inDocument(<Field path="terms" rule />, "Net 30."));
    expect(answered).toContain("Net 30.");
    expect(answered).not.toContain(FIELD_RULE);

    const plain = renderToStaticMarkup(
      inDocument(<Field path="terms" />, undefined, undefined, { partial: true })
    );
    expect(plain).toContain("—");
    expect(plain).not.toContain(FIELD_RULE);
  });

  it("composes with paragraphs: a fill line for no value, the paragraphs for a value", () => {
    const blank = renderToStaticMarkup(
      inDocument(<Field path="terms" paragraphs rule />, undefined, undefined, { partial: true })
    );
    // One fill line, in the one keep a blank value splits into.
    expect(blank.split(FIELD_RULE)).toHaveLength(2);
    expect(blank).toContain('data-keep-id="field:terms:0"');

    const answered = renderToStaticMarkup(inDocument(<Field path="terms" paragraphs rule />, THREE));
    expect(answered).toContain('data-keep-id="field:terms:2"');
    expect(answered).not.toContain(FIELD_RULE);
  });
});

describe("the check", () => {
  it("passes a paragraphed field and a fill line without rendering", async () => {
    const report = await checkElement(
      inDocument(
        <>
          <Field path="terms" paragraphs />
          <Field path="summary" rule />
        </>,
        THREE
      )
    );
    expect(report).toEqual({ unsupportedClasses: [], unresolvedPaths: [], missingImages: [] });
  });
});

describe("the PDF path", () => {
  it("draws a newline as a line break rather than collapsing it to a space", async () => {
    const read = await readPdf(
      (await renderPdf(inDocument(<Field path="terms" paragraphs />, "Ashgrove\nRowan"))).bytes
    );
    const text = read.map((page) => page.text).join("");
    // The break is in the text layer. Drop `whitespace-pre-line` from the
    // value and the same render draws "Ashgrove Rowan" on one line, which is
    // what this pair of assertions exists to catch.
    expect(text).toContain("Ashgrove\nRowan");
    expect(text).not.toContain("Ashgrove Rowan");
  }, 120_000);

  it("draws the fill line a person writes on", async () => {
    const read = await readPdf(
      (
        await renderPdf(inDocument(<Field path="terms" rule />, undefined), { partial: true })
      ).bytes
    );
    expect(read[0]?.text).toContain(FIELD_RULE);
  }, 120_000);
});

/**
 * A paragraphed field across a page break.
 *
 * The claim is per paragraph: the plan puts each one whole on a page, and the
 * engine breaks the field where the plan broke it. A field that paginated as
 * one unit would put all three paragraphs on the first page and overflow it.
 */
describe("a paragraphed field across a page break", () => {
  /** Height per keep and page budget, so the three paragraphs fall two, one. */
  const KEEP_HEIGHT = 200;
  const BUDGET = 450;

  let pages: ReadPage[];
  let planned: string[][];

  beforeAll(async () => {
    const element = inDocument(<Field path="terms" paragraphs />, THREE);
    const { node } = await fromJsx(element);
    let y = 0;
    const measured: MeasuredKeep[] = treeKeeps(node).map(({ id }) => {
      const laid = { id, top: y, bottom: y + KEEP_HEIGHT };
      y = laid.bottom;
      return laid;
    });
    const plan = planPages(measured, BUDGET);
    planned = plan.pages;
    const rendered = await renderPdf(element, { plan });
    expect(rendered.unknownBreaks).toEqual([]);
    pages = await readPdf(rendered.bytes);
  }, 180_000);

  it("plans one keep per paragraph and never splits one", () => {
    expect(planned.flat()).toEqual(["field:terms:0", "field:terms:1", "field:terms:2"]);
    expect(planned).toEqual([["field:terms:0", "field:terms:1"], ["field:terms:2"]]);
  });

  it("breaks the PDF between the same paragraphs the plan broke it between", () => {
    expect(pages.length).toBe(planned.length);
    const opening = ["Payment is due", "Work begins once", "Either party may end"];
    planned.forEach((keeps, index) => {
      const text = pages[index]?.text ?? "";
      for (const keepId of keeps) {
        const paragraph = Number(keepId.split(":")[2]);
        expect(text, `${keepId} on page ${index + 1}`).toContain(opening[paragraph]!);
      }
      // No paragraph appears on a page the plan did not put it on: a paragraph
      // drawn twice would mean the field ignored the page context.
      for (const keepId of planned.flat().filter((id) => !keeps.includes(id))) {
        const paragraph = Number(keepId.split(":")[2]);
        expect(text, `${keepId} not on page ${index + 1}`).not.toContain(opening[paragraph]!);
      }
    });
  });
});

/**
 * A paragraph taller than the page opened for it.
 *
 * Splitting at blank lines does not make a pagination unit divisible: a single
 * paragraph longer than a page is still one keep, and the plan reports it as
 * oversize with what it consumed, exactly as it reported the whole field
 * before.
 */
it("reports a paragraph taller than a page as oversize", async () => {
  const element = inDocument(<Field path="terms" paragraphs />, THREE);
  const { node } = await fromJsx(element);
  const ids = treeKeeps(node).map((keep) => keep.id);
  expect(ids).toEqual(["field:terms:0", "field:terms:1", "field:terms:2"]);
  const measured: MeasuredKeep[] = [
    { id: ids[0]!, top: 0, bottom: 100 },
    { id: ids[1]!, top: 100, bottom: 1400 },
    { id: ids[2]!, top: 1400, bottom: 1500 },
  ];
  const plan = planPages(measured, 400);
  expect(plan.oversize).toEqual([{ id: "field:terms:1", height: 1300 }]);
  // Only the oversize one overflows: the paragraphs around it paginate
  // normally, which is the whole point of splitting at blank lines.
  expect(plan.pages).toEqual([["field:terms:0"], ["field:terms:1"], ["field:terms:2"]]);
}, 60_000);
