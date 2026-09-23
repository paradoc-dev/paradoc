// @vitest-environment jsdom
/**
 * What every sheet of the preview carries, and what it costs the plan.
 *
 * Two halves, because the claim has two halves. The paginated half renders a
 * real multi-page plan sheet by sheet and asserts the bands are on every one of
 * them, each numbered for the sheet it is on — the thing a per-page element
 * written into the tree cannot do, since the plan would put it on one page. The
 * live half renders the same document through `Pages` with and without
 * furniture and asserts the published plan is the same object shape either way:
 * furniture is drawn inside the margin, so it cannot move a page break.
 */

import { act, Component, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DEFAULT_PAGE_MARGIN_PX,
  FURNITURE_EDGE_INSET_PX,
  measureKeeps,
  PageFurnitureOverflowError,
  planPages,
  type MeasuredKeep,
  type PageFurniture,
  type PagePlan,
} from "@paradoc/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProposalDocument, overflowProposalData, purchaseOrderData, purchaseOrderForm } from "../src/examples";
import { Document, Field, Page, PageNumber, Pages, Paper } from "../src";

const HEADER = "Northwind Partners LLP";
const STAMP = "DRAFT";

const furniture: PageFurniture = {
  header: <span>{HEADER}</span>,
  footer: <PageNumber />,
  stamp: <span>{STAMP}</span>,
};

function parse(markup: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = markup;
  return host;
}

/** The document's real keeps, laid out one under another at a stub height. */
function keepsOf(): MeasuredKeep[] {
  const host = parse(renderToStaticMarkup(<ProposalDocument data={overflowProposalData} />));
  let y = 0;
  return measureKeeps(host).map((keep) => {
    const laid = { ...keep, top: y, bottom: y + 100 };
    y = laid.bottom;
    return laid;
  });
}

const plan: PagePlan = planPages(keepsOf(), 900);

/** One sheet of the plan, with the furniture it was given. */
function sheet(index: number, slots: PageFurniture | undefined): HTMLElement {
  return parse(
    renderToStaticMarkup(
      <Page plan={plan} index={index} furniture={slots}>
        <ProposalDocument data={overflowProposalData} />
      </Page>
    )
  );
}

describe("every sheet of a paginated preview", () => {
  it("carries the header, the numbered footer and the stamp", () => {
    expect(plan.pages.length).toBeGreaterThan(1);
    for (let index = 0; index < plan.pages.length; index++) {
      const page = sheet(index, furniture);
      expect(page.querySelector("[data-page-header]")?.textContent).toBe(HEADER);
      expect(page.querySelector("[data-page-stamp]")?.textContent).toBe(STAMP);
      expect(page.querySelector("[data-page-footer]")?.textContent).toBe(
        `Page ${index + 1} of ${plan.pages.length}`
      );
    }
  });

  it("carries a rotated stamp on every sheet with its rotation intact", () => {
    const rotated = <span className="-rotate-45 text-9xl">{STAMP}</span>;
    for (let index = 0; index < plan.pages.length; index++) {
      const stamps = sheet(index, { stamp: rotated }).querySelectorAll("[data-page-stamp]");
      expect(stamps).toHaveLength(1);
      expect(stamps[0]!.textContent).toBe(STAMP);
      expect(stamps[0]!.firstElementChild?.classList.contains("-rotate-45")).toBe(true);
    }
  });

  it("draws the bands inside the sheet, not in the content flow", () => {
    const page = sheet(0, furniture);
    const band = page.querySelector<HTMLElement>("[data-page-header]")!;
    expect(band.style.position).toBe("absolute");
    expect(band.parentElement?.getAttribute("data-paper-sheet")).toBe("true");
    expect(band.querySelector("[data-keep-id]")).toBeNull();
  });

  // The stamp is drawn behind the document rather than over it, and that is two
  // declarations working together: the sheet is its own stacking context, and
  // the layer sits below the flow inside it. Deleting either puts the watermark
  // over the text in the preview and behind it in the PDF, which is the two
  // outputs disagreeing about the same page.
  it("draws the stamp below the content, inside a sheet that is its own stacking context", () => {
    const page = sheet(0, furniture);
    const stamp = page.querySelector<HTMLElement>("[data-page-stamp]")!;
    expect(stamp.style.zIndex).toBe("-1");
    expect(page.querySelector<HTMLElement>("[data-paper-sheet]")!.style.isolation).toBe("isolate");
  });

  it("draws no band at all when the document declares no furniture", () => {
    const page = sheet(0, undefined);
    expect(page.querySelector("[data-page-header]")).toBeNull();
    expect(page.querySelector("[data-page-footer]")).toBeNull();
    expect(page.querySelector("[data-page-stamp]")).toBeNull();
  });

  it("numbers a slot that asks for no count with the page alone", () => {
    const page = parse(
      renderToStaticMarkup(
        <Page plan={plan} index={2} furniture={{ footer: <PageNumber total={false} /> }}>
          <ProposalDocument data={overflowProposalData} />
        </Page>
      )
    );
    expect(page.querySelector("[data-page-footer]")?.textContent).toBe("Page 3");
  });
});

describe("one sheet on its own", () => {
  it("carries the furniture and numbers itself page 1 of 1", () => {
    const page = parse(
      renderToStaticMarkup(
        <Paper furniture={furniture}>
          <ProposalDocument data={overflowProposalData} />
        </Paper>
      )
    );
    expect(page.querySelector("[data-page-header]")?.textContent).toBe(HEADER);
    expect(page.querySelector("[data-page-footer]")?.textContent).toBe("Page 1 of 1");
  });
});

describe("what furniture costs the plan", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(document, "fonts", { value: undefined, configurable: true });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  /** The plan `Pages` publishes for the same document, furnished or bare. */
  async function publishedPlan(slots: PageFurniture | undefined): Promise<PagePlan> {
    const paginate = vi.fn();
    await act(async () =>
      root.render(
        <Pages onPaginate={paginate} furniture={slots}>
          <Document artifact={purchaseOrderForm} data={purchaseOrderData}>
            <Field path="orderNumber" />
          </Document>
        </Pages>
      )
    );
    expect(paginate).toHaveBeenCalledTimes(1);
    return paginate.mock.calls[0]![0] as PagePlan;
  }

  it("publishes the same plan furnished as bare, and still draws the bands", async () => {
    const bare = await publishedPlan(undefined);
    await act(async () => root.unmount());
    root = createRoot(host);
    const furnished = await publishedPlan(furniture);
    expect(furnished).toEqual(bare);
    expect(host.querySelector("[data-page-header]")?.textContent).toBe(HEADER);
    expect(host.querySelector("[data-page-footer]")?.textContent).toBe("Page 1 of 1");
  });

  // Why the plan cannot move: the pass that measures the document renders the
  // children and nothing else. Furniture is drawn by the sheet, so it is never
  // measured, so it can never push a keep onto the next page. Comparing two
  // plans says they matched once; this says they cannot differ.
  it("keeps the furniture out of the pass that measures the document", async () => {
    await publishedPlan(furniture);
    const measured = host.querySelector("[data-paper-measure]")!;
    expect(measured.querySelector("[data-page-header]")).toBeNull();
    expect(measured.querySelector("[data-page-footer]")).toBeNull();
    expect(measured.querySelector("[data-page-stamp]")).toBeNull();
    expect(measured.textContent).not.toContain(HEADER);
    expect(measured.textContent).not.toContain(STAMP);
  });
});

describe("a band that does not fit the margin in the preview", () => {
  let host: HTMLDivElement;
  let root: Root;
  const failures: unknown[] = [];

  /** Catches what the preview throws from render, as an application would. */
  class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    override state = { failed: false };
    static getDerivedStateFromError() {
      return { failed: true };
    }
    override componentDidCatch(error: unknown) {
      failures.push(error);
    }
    override render() {
      return this.state.failed ? null : this.props.children;
    }
  }

  /**
   * jsdom lays nothing out, so each box is given the height its first child
   * declares, and each keep of the measured document a 100 px row of its own:
   * enough rows to run the proposal onto several sheets.
   */
  function stubLayout() {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const keeps = [...document.querySelectorAll("[data-paper-measure] [data-keep-id]")];
      const row = keeps.indexOf(this);
      const top = row < 0 ? 0 : row * 100;
      const declared = Number.parseFloat((this.firstElementChild as HTMLElement | null)?.style.height ?? "");
      const height = row < 0 ? (Number.isNaN(declared) ? 0 : declared) : 100;
      return { x: 0, y: top, top, left: 0, right: 0, width: 0, height, bottom: top + height, toJSON: () => ({}) } as DOMRect;
    });
  }

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(document, "fonts", { value: undefined, configurable: true });
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubLayout();
    failures.length = 0;
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  const budgetPx = DEFAULT_PAGE_MARGIN_PX - FURNITURE_EDGE_INSET_PX;

  it("fails from Pages by name instead of drawing the footer over the content", async () => {
    const tall = <div style={{ height: 80 }}>Too much foot</div>;
    await act(async () =>
      root.render(
        <Boundary>
          <Pages furniture={{ footer: tall }}>
            <ProposalDocument data={overflowProposalData} />
          </Pages>
        </Boundary>
      )
    );
    expect(failures).toHaveLength(1);
    expect(failures[0]).toBeInstanceOf(PageFurnitureOverflowError);
    const error = failures[0] as PageFurnitureOverflowError;
    expect(error.slot).toBe("footer");
    expect(error.heightPx).toBe(80);
    expect(error.budgetPx).toBe(budgetPx);
    expect(error.marginPx).toBe(DEFAULT_PAGE_MARGIN_PX);
    expect(host.querySelector("[data-paper-sheet]")).toBeNull();
  });

  it("fails from Paper by name for a header taller than the margin", async () => {
    const tall = <div style={{ height: budgetPx + 1 }}>Too much head</div>;
    await act(async () =>
      root.render(
        <Boundary>
          <Paper furniture={{ header: tall }}>
            <ProposalDocument data={overflowProposalData} />
          </Paper>
        </Boundary>
      )
    );
    expect(failures).toHaveLength(1);
    expect(failures[0]).toBeInstanceOf(PageFurnitureOverflowError);
    expect((failures[0] as PageFurnitureOverflowError).slot).toBe("header");
    expect((failures[0] as PageFurnitureOverflowError).heightPx).toBe(budgetPx + 1);
  });

  it("draws a band that exactly fills the margin's budget on every sheet", async () => {
    const snug = <div style={{ height: budgetPx }}>{HEADER}</div>;
    await act(async () =>
      root.render(
        <Boundary>
          <Pages furniture={{ header: snug, footer: <PageNumber /> }}>
            <ProposalDocument data={overflowProposalData} />
          </Pages>
        </Boundary>
      )
    );
    expect(failures).toEqual([]);
    const sheets = [...host.querySelectorAll("[data-paper-sheet]")];
    expect(sheets.length).toBeGreaterThan(1);
    sheets.forEach((sheet, index) => {
      expect(sheet.querySelector("[data-page-header]")?.textContent).toBe(HEADER);
      expect(sheet.querySelector("[data-page-footer]")?.textContent).toBe(`Page ${index + 1} of ${sheets.length}`);
    });
  });
});
