/**
 * What `Text` and `List` promise, checked on both outputs.
 *
 * Two claims the components exist for. That prose follows the document's
 * `typography` token at every level, the way a field's label does — so the
 * markup assertions here are per role per level, not one spot check. And that
 * a list's markers are the same characters in the preview and in the PDF,
 * which is only provable by reading the rendered file back: the engine draws
 * no list markers of its own, so a marker that reached the page any other way
 * would be a marker the browser and the engine each invented.
 *
 * These renders are also the vocabulary check: the takumi adapter refuses a
 * class it has not verified (`UnsupportedPdfContentError`), so a `list-disc` or
 * a hand-picked `text-[13px]` added to either component fails this suite before
 * it reaches a page.
 *
 * The pagination claim is checked the way the blocks' suite checks a table's:
 * a plan built from the resolved tree with invented heights, handed to the
 * render, so the breaks are the preview's and the pages are the engine's.
 */

import { fromJsx } from "@takumi-rs/helpers/jsx";
import {
  InvalidPagePlanInputError,
  PageContextProvider,
  planPages,
  TYPOGRAPHY_LEVELS,
  type MeasuredKeep,
  type PageContextValue,
} from "@paradoc/react";
import { renderPdf } from "@paradoc/react-pdf";
import { checkElement } from "@paradoc/react-pdf/check";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";

import { Document, List, Section, Text } from "../src";
import type { ListItem, TextRole } from "../src";
import { proposalForm } from "../src/examples/proposal";
import { shortProposalData } from "../src/examples/proposal-data";
import { readPdf, treeKeeps, type ReadPage } from "../../react-pdf/tests/pdf-reader";

type Tokens = Parameters<typeof Document>[0]["tokens"];

function inDocument(children: React.ReactNode, tokens?: Tokens) {
  return (
    <Document artifact={proposalForm} data={shortProposalData} tokens={tokens} id="prose">
      {children}
    </Document>
  );
}

/**
 * `children` as one page of a plan would see them: only `keeps` are on it.
 *
 * A withdrawal rule is invisible in an unpaginated render, because every keep
 * is visible there. Supplying the page context by hand is what makes the rule
 * observable without a browser.
 */
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

/** The three clauses the nested sample carries, one with sub-items of its own. */
const CLAUSES: readonly ListItem[] = [
  { text: "The provider performs the services." },
  {
    text: "The customer provides:",
    items: [{ text: "Site access." }, { text: "Power at each position." }],
  },
  { text: "Either party may terminate on notice." },
];

describe("Text", () => {
  /**
   * One row per role per level. A role whose size stopped moving with the
   * token, or a level that stepped one role and not another, fails here by
   * name rather than in whichever document happened to notice.
   */
  const EXPECTED: Record<TextRole, Record<string, string>> = {
    heading: {
      compact: "text-base font-semibold leading-none text-neutral-900",
      regular: "text-lg font-semibold leading-tight text-neutral-900",
      roomy: "text-xl font-semibold leading-snug text-neutral-900",
    },
    body: {
      compact: "text-xs leading-snug text-neutral-800",
      regular: "text-sm leading-relaxed text-neutral-800",
      roomy: "text-base leading-loose text-neutral-800",
    },
    caption: {
      compact: "text-xs italic leading-tight text-neutral-500",
      regular: "text-xs italic leading-snug text-neutral-500",
      roomy: "text-sm italic leading-relaxed text-neutral-500",
    },
    small: {
      compact: "text-xs leading-tight text-neutral-600",
      regular: "text-xs leading-snug text-neutral-600",
      roomy: "text-sm leading-relaxed text-neutral-600",
    },
  };

  it.each(Object.keys(EXPECTED) as TextRole[])("steps %s at every level of the scale", (role) => {
    for (const scale of TYPOGRAPHY_LEVELS) {
      const html = renderToStaticMarkup(
        inDocument(<Text keepId={`t:${role}`} role={role}>Prose</Text>, { typography: { scale } })
      );
      expect(html, `${role} at ${scale}`).toContain(`class="${EXPECTED[role][scale]}"`);
    }
  });

  it("renders each role as its own element and marks the role on it", () => {
    const html = renderToStaticMarkup(
      inDocument(
        <>
          <Text keepId="t:heading" role="heading">Scope</Text>
          <Text keepId="t:body">Body</Text>
        </>
      )
    );
    expect(html).toContain('<h2 data-text-role="heading"');
    expect(html).toContain('<p data-text-role="body"');
    expect(html).toContain('data-keep-id="t:heading"');
    expect(html).toContain('data-keep-id="t:body"');
  });

  it("renders the element `as` names instead of the role's own", () => {
    const html = renderToStaticMarkup(
      inDocument(<Text keepId="t:heading" role="heading" as="h1">Scope</Text>)
    );
    expect(html).toContain("<h1 ");
    expect(html).not.toContain("<h2 ");
  });

  it("lets an explicit className win over the role and the token", () => {
    const html = renderToStaticMarkup(
      inDocument(<Text keepId="t:body" className="text-base text-neutral-900">Body</Text>, {
        typography: { scale: "compact" },
      })
    );
    // Exact, on the element itself: the root carries the token's own classes,
    // so a substring match would pass on the document around the prose.
    expect(html).toContain('<p data-text-role="body" class="text-base text-neutral-900"');
  });

  it("draws only on the page the plan put it on", () => {
    // A `Text` is a keep, so the page it belongs to is the page context's
    // decision. Without it a paginated preview would print every paragraph on
    // every sheet.
    const prose = (
      <>
        <Text keepId="t:first">First paragraph</Text>
        <Text keepId="t:second">Second paragraph</Text>
      </>
    );
    const first = renderToStaticMarkup(inDocument(onPage(prose, ["t:first"])));
    expect(first).toContain("First paragraph");
    expect(first).not.toContain("Second paragraph");

    const second = renderToStaticMarkup(inDocument(onPage(prose, ["t:second"])));
    expect(second).not.toContain("First paragraph");
    expect(second).toContain("Second paragraph");
  });
});

describe("List", () => {
  it("numbers an ordered list and prefixes a nested one with its parent's marker", () => {
    const html = renderToStaticMarkup(inDocument(<List id="clauses" items={CLAUSES} />));
    expect(html).toContain('data-list-marker="1."');
    expect(html).toContain('data-list-marker="2."');
    expect(html).toContain('data-list-marker="3."');
    expect(html).toContain('data-list-marker="2.a."');
    expect(html).toContain('data-list-marker="2.b."');
    expect(html).toContain('data-keep-id="clauses:0"');
    expect(html).toContain('data-keep-id="clauses:1:1"');
  });

  it.each([
    ["bullet", ["•"]],
    ["roman", ["i.", "ii.", "iii."]],
    ["lower-alpha", ["a.", "b.", "c."]],
    ["decimal", ["1.", "2.", "3."]],
  ] as const)("marks a %s list", (marker, labels) => {
    const html = renderToStaticMarkup(
      inDocument(
        <List
          id="m"
          marker={marker}
          items={[{ text: "One" }, { text: "Two" }, { text: "Three" }]}
        />
      )
    );
    for (const label of labels) expect(html).toContain(`data-list-marker="${label}"`);
  });

  it("marks a nested level with nestedMarker rather than the top level's own", () => {
    const html = renderToStaticMarkup(
      inDocument(
        <List
          id="clauses"
          nestedMarker="roman"
          items={[{ text: "Two", items: [{ text: "Sub" }, { text: "Sub" }] }]}
        />
      )
    );
    expect(html).toContain('data-list-marker="1.i."');
    expect(html).toContain('data-list-marker="1.ii."');
  });

  it("leaves a bullet out of the marker chain, above and below it", () => {
    // A bullet names nothing, so it contributes no token: a numbered level
    // under a bullet starts its own chain, and a bullet under a number is
    // still one character.
    const underNumber = renderToStaticMarkup(
      inDocument(
        <List id="a" nestedMarker="bullet" items={[{ text: "Two", items: [{ text: "Sub" }] }]} />
      )
    );
    expect(underNumber).toContain('data-list-marker="\u2022"');
    expect(underNumber).not.toContain('data-list-marker="1.\u2022"');

    const underBullet = renderToStaticMarkup(
      inDocument(
        <List
          id="b"
          marker="bullet"
          nestedMarker="decimal"
          items={[{ text: "One", items: [{ text: "Sub" }] }]}
        />
      )
    );
    expect(underBullet).toContain('data-list-marker="1."');
    expect(underBullet).not.toContain('data-list-marker="\u2022.1."');
  });

  it("carries the marker and the item text at the document's scale", () => {
    const roomy = renderToStaticMarkup(
      inDocument(<List id="m" items={[{ text: "One" }]} />, { typography: { scale: "roomy" } })
    );
    expect(roomy).toContain('class="basis-10 text-base text-neutral-500"');
    expect(roomy).toContain('class="flex-1 text-base leading-loose text-neutral-800"');

    const compact = renderToStaticMarkup(
      inDocument(<List id="m" items={[{ text: "One" }]} />, { typography: { scale: "compact" } })
    );
    expect(compact).toContain('class="basis-10 text-xs text-neutral-500"');
    expect(compact).toContain('class="flex-1 text-xs leading-snug text-neutral-800"');
  });

  it("steps the gap between items with the document's flow", () => {
    const roomy = renderToStaticMarkup(
      inDocument(<List id="m" items={[{ text: "One" }]} />, { typography: { flow: "roomy" } })
    );
    expect(roomy).toContain('class="flex flex-col gap-5" data-list="m"');
    const compact = renderToStaticMarkup(
      inDocument(<List id="m" items={[{ text: "One" }]} />, { typography: { flow: "compact" } })
    );
    // Never `gap-0`: a compact list still separates its items.
    expect(compact).toContain('class="flex flex-col gap-1" data-list="m"');
  });

  it("indents a nested level and leaves the top one flush", () => {
    const html = renderToStaticMarkup(inDocument(<List id="clauses" items={CLAUSES} />));
    expect(html).toContain('class="flex flex-col gap-3" data-list="clauses"');
    expect(html).toContain('class="flex flex-col gap-3 pl-6" data-list="clauses:1"');
  });

  it("lets an explicit className replace the list's own layout", () => {
    const html = renderToStaticMarkup(
      inDocument(<List id="m" className="flex flex-col gap-8" items={[{ text: "One" }]} />)
    );
    expect(html).toContain('class="flex flex-col gap-8" data-list="m"');
  });

  it("withdraws a level from a page holding none of its items", () => {
    // An empty flex child still takes its parent's gap, so a level that stayed
    // on a page with nothing of its own would make the drawn page taller than
    // the flow the plan was measured against.
    const list = <List id="clauses" items={CLAUSES} />;
    const first = renderToStaticMarkup(inDocument(onPage(list, ["clauses:0"])));
    expect(first).toContain('data-list="clauses"');
    expect(first).toContain("The provider performs the services.");
    // The nested level's own container withdraws with its items.
    expect(first).not.toContain('data-list="clauses:1"');
    expect(first).not.toContain("Site access.");

    const nested = renderToStaticMarkup(inDocument(onPage(list, ["clauses:1:0"])));
    expect(nested).toContain('data-list="clauses:1"');
    expect(nested).toContain("Site access.");
    expect(nested).not.toContain("The provider performs the services.");

    const none = renderToStaticMarkup(inDocument(onPage(list, ["elsewhere"])));
    expect(none).not.toContain('data-list="clauses"');
  });

  it("keeps two lists apart by their ids, and fails the plan when they share one", async () => {
    // Why `id` is required rather than defaulted: the prefix is what makes an
    // item's keep id unique in the document, and a duplicate is not a cosmetic
    // fault — `planPages` refuses the whole plan.
    const two = (first: string, second: string) =>
      inDocument(
        <>
          <List id={first} items={[{ text: "One" }]} />
          <List id={second} items={[{ text: "Two" }]} />
        </>
      );
    const distinct = treeKeeps((await fromJsx(two("exclusions", "inclusions"))).node);
    expect(distinct.map((keep) => keep.id)).toEqual(["exclusions:0", "inclusions:0"]);
    expect(() => planPages(distinct.map((keep) => ({ id: keep.id, top: 0, bottom: 10 })), 900)).not.toThrow();

    const shared = treeKeeps((await fromJsx(two("clauses", "clauses"))).node);
    expect(() =>
      planPages(shared.map((keep) => ({ id: keep.id, top: 0, bottom: 10 })), 900)
    ).toThrowError(InvalidPagePlanInputError);
  });

  it("renders nothing for no items, so an empty list takes no gap", () => {
    const html = renderToStaticMarkup(inDocument(<List id="m" items={[]} />));
    expect(html).not.toContain("data-list");
    expect(html).not.toContain("data-keep-id");
  });

  it("numbers past the end of each marker alphabet", () => {
    // A list long enough to exhaust `a..z` or to need a compound numeral is
    // not a special case a composition should have to know about.
    const many = Array.from({ length: 27 }, (_value, index) => ({ text: `Item ${index}` }));
    const alpha = renderToStaticMarkup(inDocument(<List id="m" marker="lower-alpha" items={many} />));
    expect(alpha).toContain('data-list-marker="z."');
    expect(alpha).toContain('data-list-marker="aa."');
    const roman = renderToStaticMarkup(inDocument(<List id="m" marker="roman" items={many} />));
    expect(roman).toContain('data-list-marker="xxvii."');
  });
});

/**
 * The PDF path, on the default engine.
 *
 * The prose and the markers have to be on the page as text a reader can
 * select, because that is the only evidence that the engine drew the same
 * characters the preview did rather than dropping a marker it had no rule for.
 */
describe("the PDF path", () => {
  let composed: ReadPage[];

  beforeAll(async () => {
    composed = await readPdf(
      (
        await renderPdf(
          inDocument(
            <Section id="scope" title="Work included">
              <Text keepId="prose:heading" role="heading">Services in scope</Text>
              <Text keepId="prose:body">
                The provider will survey the site and commission the equipment.
              </Text>
              <List id="clauses" items={CLAUSES} />
              <Text keepId="prose:caption" role="caption">Estimates until the survey is complete.</Text>
              <Text keepId="prose:small" role="small">Not an offer until countersigned.</Text>
            </Section>
          )
        )
      ).bytes
    );
  }, 120_000);

  it("draws every role: the heading, the body, the caption and the small print", () => {
    const text = composed.map((page) => page.text).join(" ");
    // Distinct from the enclosing Section's own title, so deleting the
    // heading `Text` fails this rather than leaving the section's heading to
    // satisfy it.
    expect(text).toContain("Services in scope");
    expect(text).toContain("The provider will survey the site");
    expect(text).toContain("Estimates until the survey is complete.");
    expect(text).toContain("Not an offer until countersigned.");
  });

  it("draws every marker, including the nested list's prefixed ones", () => {
    const text = composed.map((page) => page.text).join(" ");
    for (const marker of ["1.", "2.", "3.", "2.a.", "2.b."]) {
      expect(text, `marker ${marker}`).toContain(marker);
    }
  });

  it("draws a bullet the engine has a glyph for", async () => {
    const read = await readPdf(
      (
        await renderPdf(
          inDocument(<List id="b" marker="bullet" items={[{ text: "Site survey" }]} />)
        )
      ).bytes
    );
    expect(read[0]?.text).toContain("•");
    expect(read[0]?.text).toContain("Site survey");
  }, 120_000);
});

describe("the check", () => {
  it("passes a composition of prose and lists without rendering", async () => {
    const report = await checkElement(
      inDocument(
        <>
          <Text keepId="check:heading" role="heading">Scope</Text>
          <Text keepId="check:body">The provider will survey the site.</Text>
          <List id="check" items={CLAUSES} />
        </>
      )
    );
    expect(report).toEqual({ unsupportedClasses: [], unresolvedPaths: [], missingImages: [] });
  });

  it("names a class a copy owner pinned outside the vocabulary", async () => {
    // The opt-out `className` gives is also the way a copy owner can leave the
    // vocabulary, so the check has to catch it on these components as on any
    // other — by name, before anything renders.
    const report = await checkElement(
      inDocument(
        <>
          <Text keepId="check:body" className="text-[13px] align-super">Body</Text>
          <List id="check" className="list-decimal" items={[{ text: "One" }]} />
        </>
      )
    );
    expect(report.unsupportedClasses.sort()).toEqual(["align-super", "list-decimal", "text-[13px]"]);
  });
});

/**
 * The token on the PDF path, at every level.
 *
 * The markup assertions above prove which classes a level produces. This
 * proves the page still comes out, which is a claim only the engine can
 * settle: the takumi adapter refuses a class it has not verified, so a step
 * that landed outside the vocabulary — a size past the end of the scale, a
 * leading that stepped to a name the probe never admitted — fails here rather
 * than drawing a page that quietly ignored it. It is the same argument
 * `typography.test.tsx` makes for the sample documents, for the two components
 * no sample document carries yet.
 */
it("renders prose and a list to PDF at every scale and flow", async () => {
  const prose = (
    <>
      <Text keepId="level:heading" role="heading">Scope</Text>
      <Text keepId="level:body">The provider will survey the site.</Text>
      <Text keepId="level:caption" role="caption">Estimates only.</Text>
      <Text keepId="level:small" role="small">Not an offer.</Text>
      <List id="level" items={CLAUSES} />
    </>
  );
  for (const scale of TYPOGRAPHY_LEVELS) {
    for (const flow of TYPOGRAPHY_LEVELS) {
      const read = await readPdf(
        (await renderPdf(inDocument(prose, { typography: { scale, flow } }))).bytes
      );
      const text = read.map((page) => page.text).join(" ");
      expect(text, `heading at ${scale}/${flow}`).toContain("Scope");
      expect(text, `small at ${scale}/${flow}`).toContain("Not an offer.");
      expect(text, `nested marker at ${scale}/${flow}`).toContain("2.b.");
    }
  }
}, 180_000);

/**
 * A list that crosses a page boundary.
 *
 * The claim is per item: the plan puts each one whole on a page, and the
 * engine draws it there. A list that paginated as one block would put every
 * item on the first page and overflow it; a list whose items were not keeps at
 * all would let the engine break one in the middle.
 */
describe("a list across a page break", () => {
  const ITEMS: readonly ListItem[] = Array.from({ length: 9 }, (_value, index) => ({
    text: `Clause number ${index + 1} of the schedule`,
  }));
  /** Height per keep and page budget, so the nine items fall four, four, one. */
  const KEEP_HEIGHT = 100;
  const BUDGET = 450;

  let pages: ReadPage[];
  let planned: string[][];

  beforeAll(async () => {
    const element = inDocument(<List id="schedule" items={ITEMS} />);
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

  it("plans one keep per item and never splits one", () => {
    expect(planned.flat()).toEqual(ITEMS.map((_item, index) => `schedule:${index}`));
    expect(planned.length).toBeGreaterThan(1);
    // The real invariant: a page never carries more than it measures room for.
    for (const page of planned) expect(page.length * KEEP_HEIGHT).toBeLessThanOrEqual(BUDGET);
  });

  it("draws each item whole on the page the plan put it on", () => {
    expect(pages.length).toBe(planned.length);
    planned.forEach((keeps, index) => {
      const text = pages[index]?.text ?? "";
      for (const keepId of keeps) {
        const item = Number(keepId.split(":")[1]);
        expect(text, `${keepId} on page ${index + 1}`).toContain(`${item + 1}.`);
        expect(text, `${keepId} on page ${index + 1}`).toContain(
          `Clause number ${item + 1} of the schedule`
        );
      }
      // Nothing from another page leaked onto this one: an item drawn twice
      // would mean the list ignored the page context rather than withdrawing.
      for (const keepId of planned.flat().filter((id) => !keeps.includes(id))) {
        const item = Number(keepId.split(":")[1]);
        expect(text, `${keepId} not on page ${index + 1}`).not.toContain(
          `Clause number ${item + 1} of the schedule`
        );
      }
    });
  });
});
