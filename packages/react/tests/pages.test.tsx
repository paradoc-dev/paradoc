// @vitest-environment jsdom
/**
 * One tree, rendered once per page.
 *
 * The document is rendered once to find its keeps, given stub heights, and
 * planned. Each page of that plan is then rendered from the same tree, and what
 * is asserted is that the page carries exactly the keeps the plan put on it:
 * the table header on every continued page, the sections that still have
 * content, and nothing else. No DOM node is moved and no markup is duplicated,
 * so a page is only ever the tree with most of it returning null.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Page } from "../src/components/pages";
import { ProposalDocument, overflowProposalData, shortProposalData } from "../src/examples";
import { measureKeeps } from "../src/lib/measure";
import { planPages, type MeasuredKeep, type PagePlan } from "../src/lib/plan";
import { usePagePlan } from "../src/components/page-context";

function parse(markup: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = markup;
  return host;
}

/**
 * The document's keeps, read from real markup so ids, table membership and
 * section nesting are the ones the components actually emit, then laid out one
 * under another at a stub height. jsdom has no layout engine, so the geometry
 * is the stub; `plan.test.ts` is where the arithmetic is checked.
 */
function keepsOf(
  data: typeof shortProposalData,
  heightOf: (id: string) => number
): MeasuredKeep[] {
  const host = parse(renderToStaticMarkup(<ProposalDocument data={data} />));
  let y = 0;
  return measureKeeps(host).map((keep) => {
    const laid = { ...keep, top: y, bottom: y + heightOf(keep.id) };
    y = laid.bottom;
    return laid;
  });
}

const ROW_HEIGHT = 100;
// Deliberately not PAGE_CONTENT_HEIGHT_PX: anything reading the constant rather
// than the plan's own budget has to fail here.
const BUDGET = 900;

const keeps = keepsOf(overflowProposalData, () => ROW_HEIGHT);
const plan = planPages(keeps, BUDGET);

/** The parsed markup of one page of a plan. */
function renderPage(pagePlan: PagePlan, index: number, data = overflowProposalData): HTMLElement {
  return parse(
    renderToStaticMarkup(
      <Page plan={pagePlan} index={index}>
        <ProposalDocument data={data} />
      </Page>
    )
  );
}

function idsOn(page: HTMLElement): string[] {
  return [...page.querySelectorAll("[data-keep-id]")].map(
    (element) => element.getAttribute("data-keep-id")!
  );
}

describe("the measured keeps come from the tree itself", () => {
  it("finds every keep, in document order", () => {
    expect(keeps.length).toBeGreaterThan(70);
    // The masthead's organization mark leads the document; the title follows it.
    expect(keeps[0]!.id).toBe("logo");
    expect(keeps[1]!.id).toBe("title");
    expect(keeps.at(-1)!.id).toBe("signature:customer");
  });

  it("names the table each header and row belongs to", () => {
    const header = keeps.find((keep) => keep.id === "line-items:header")!;
    const row = keeps.find((keep) => keep.id === "line-items:7")!;
    expect(header).toMatchObject({ table: "line-items", tableHeader: true });
    expect(row).toMatchObject({ table: "line-items", tableHeader: false });
  });

  it("records the sections enclosing each keep", () => {
    expect(keeps.find((keep) => keep.id === "field:summary")!.sections).toEqual(["summary"]);
    expect(keeps.find((keep) => keep.id === "totals")!.sections).toEqual(["line-items"]);
  });
});

describe("the plan for the overflow set", () => {
  it("runs to several pages", () => {
    expect(plan.pages.length).toBeGreaterThanOrEqual(3);
  });

  it("puts every keep of the document on exactly one page, in order", () => {
    const placed = plan.pages.flatMap((page, index) =>
      page.filter((id) => !plan.repeats[index]!.includes(id))
    );
    expect(placed).toEqual(keeps.map((keep) => keep.id));
  });
});

describe("each page renders only its own keeps", () => {
  it.each(plan.pages.map((_page, index) => index))("page %i", (index) => {
    expect(idsOn(renderPage(plan, index))).toEqual(plan.pages[index]);
  });

  it("numbers the page container from one", () => {
    for (const index of plan.pages.keys()) {
      const sheet = renderPage(plan, index).querySelector("[data-paper-sheet]")!;
      expect(sheet.getAttribute("data-page")).toBe(String(index + 1));
    }
  });
});

describe("the table header repeats on every continued page", () => {
  const rowsOn = (index: number) =>
    (plan.pages[index] ?? []).filter((id) => /^line-items:\d+$/.test(id));

  it("has continued pages to check", () => {
    const continued = plan.pages.filter((_page, index) => index > 0 && rowsOn(index).length > 0);
    expect(continued.length).toBeGreaterThanOrEqual(2);
  });

  it("renders the header above the rows on every page that carries a row", () => {
    for (const index of plan.pages.keys()) {
      if (rowsOn(index).length === 0) continue;
      const page = renderPage(plan, index);
      const ids = idsOn(page);
      const header = ids.indexOf("line-items:header");
      expect(page.querySelector('[data-table-header="line-items"]')).not.toBeNull();
      expect(header, `page ${index + 1} has rows but no header`).toBeGreaterThanOrEqual(0);
      for (const row of rowsOn(index)) expect(ids.indexOf(row)).toBeGreaterThan(header);
      expect(ids).toHaveLength(new Set(ids).size);
    }
  });

  it("puts the repeated header first on a page the table did not start", () => {
    const repeats = [...plan.pages.keys()].filter(
      (index) => index > 0 && plan.pages[index]![0] === "line-items:header"
    );
    expect(repeats.length).toBeGreaterThanOrEqual(2);
    for (const index of repeats) {
      expect(idsOn(renderPage(plan, index))[0]).toBe("line-items:header");
    }
  });

  it("marks a copied header in the DOM and leaves every other keep unmarked", () => {
    for (const index of plan.pages.keys()) {
      const page = renderPage(plan, index);
      const marked = [...page.querySelectorAll("[data-keep-repeat]")].map(
        (element) => element.getAttribute("data-keep-id")!
      );
      expect(marked).toEqual(plan.repeats[index]);
    }
    expect(plan.repeats.flat().length).toBeGreaterThanOrEqual(2);
  });

  it("renders the header once, not once per row", () => {
    for (const index of plan.pages.keys()) {
      const page = renderPage(plan, index);
      expect(page.querySelectorAll('[data-table-header="line-items"]')).toHaveLength(
        (plan.pages[index] ?? []).includes("line-items:header") ? 1 : 0
      );
    }
  });
});

describe("the table withdraws from a page holding none of its keeps", () => {
  const totalsOnly: PagePlan = {
    pages: [["totals"]],
    repeats: [[]],
    sections: [["line-items"]],
    breaks: [],
    oversize: [],
    budget: BUDGET,
  };

  it("renders no table wrapper, so the section keeps the flow it was measured in", () => {
    const page = renderPage(totalsOnly, 0, shortProposalData);
    const section = page.querySelector('[data-section="line-items"]')!;
    expect(page.querySelector("[data-table-header]")).toBeNull();
    expect(page.querySelector('[data-keep-id="totals"]')).not.toBeNull();
    expect(section.children).toHaveLength(1);
  });
});

describe("a document with no keeps", () => {
  const empty = planPages([], BUDGET);

  it("plans no pages, and still renders as a sheet of paper", () => {
    expect(empty.pages).toEqual([]);
    const page = renderPage(empty, 0, shortProposalData);
    expect(page.querySelector("[data-paper-sheet]")?.getAttribute("data-page")).toBe("1");
    expect(idsOn(page)).toEqual([]);
  });
});

describe("a section collapses on the pages that hold none of its keeps", () => {
  it("keeps the masthead on the first page only", () => {
    expect(renderPage(plan, 0).querySelector('[data-section="masthead"]')).not.toBeNull();
    for (const index of plan.pages.keys()) {
      if (index === 0) continue;
      expect(renderPage(plan, index).querySelector('[data-section="masthead"]')).toBeNull();
    }
  });

  it("renders a section on exactly the pages the plan lists it on", () => {
    for (const index of plan.pages.keys()) {
      const page = renderPage(plan, index);
      const rendered = [...page.querySelectorAll("[data-section]")].map(
        (element) => element.getAttribute("data-section")!
      );
      expect(new Set(rendered)).toEqual(new Set(plan.sections[index]));
    }
  });
});

describe("the whole plan is readable from inside a page", () => {
  function Readout() {
    const readable = usePagePlan();
    return <span data-plan-pages={readable?.pages.length} data-plan-breaks={readable?.breaks.length} />;
  }

  it("reports the page count and the breaks", () => {
    const markup = renderToStaticMarkup(
      <Page plan={plan} index={1}>
        <Readout />
      </Page>
    );
    expect(markup).toContain(`data-plan-pages="${plan.pages.length}"`);
    expect(markup).toContain(`data-plan-breaks="${plan.breaks.length}"`);
  });

  it("reports nothing outside a page", () => {
    expect(renderToStaticMarkup(<Readout />)).not.toContain("data-plan-pages");
  });
});

describe("an oversize keep", () => {
  const tallPlan = planPages(
    keepsOf(shortProposalData, (id) => (id === "field:terms" ? 1400 : 10)),
    BUDGET
  );
  const oversizePage = tallPlan.pages.findIndex((page) => page.includes("field:terms"));

  it("is alone on its own page", () => {
    expect(tallPlan.oversize).toEqual([{ id: "field:terms", height: 1400 }]);
    expect(tallPlan.pages[oversizePage]).toEqual(["field:terms"]);
  });

  it("is reported on that page, naming the keep and its height", () => {
    const marker = renderPage(tallPlan, oversizePage, shortProposalData).querySelector(
      "[data-oversize-keep]"
    )!;
    expect(marker.getAttribute("data-oversize-keep")).toBe("field:terms");
    expect(marker.textContent).toContain("field:terms");
    expect(marker.textContent).toContain("1400 px");
    expect(marker.textContent).toContain(`${BUDGET} px`);
  });

  it("leaves every other page unmarked", () => {
    for (const index of tallPlan.pages.keys()) {
      if (index === oversizePage) continue;
      expect(
        renderPage(tallPlan, index, shortProposalData).querySelector("[data-oversize-keep]")
      ).toBeNull();
    }
  });
});

describe("the short set fits one page", () => {
  it("plans a single page when every keep fits", () => {
    const single = planPages(keepsOf(shortProposalData, () => 10), BUDGET);
    expect(single.pages).toHaveLength(1);
    expect(single.breaks).toEqual([]);
    expect(single.oversize).toEqual([]);
  });
});
