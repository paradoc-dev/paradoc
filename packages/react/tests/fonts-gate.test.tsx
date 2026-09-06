// @vitest-environment jsdom
/**
 * The fonts gate, and repagination.
 *
 * Page breaks computed against a fallback face are wrong the moment the real
 * face arrives, so `Pages` renders no page at all until `document.fonts.ready`
 * resolves. jsdom loads no fonts, so the test owns that promise and decides
 * when it settles.
 *
 * jsdom also has no layout engine: every keep measures zero, so the plan that
 * comes out is one page. What is under test here is the gate and the
 * repagination, not the arithmetic — that is `plan.test.ts`.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Pages } from "../src/components/pages";
import type { PagePlan } from "../src/lib/plan";
import { ProposalDocument, overflowProposalData, shortProposalData } from "../src/examples";

let container: HTMLDivElement;
let root: Root;
let loadFonts: () => void;

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const ready = new Promise<void>((resolve) => {
    loadFonts = resolve;
  });
  Object.defineProperty(document, "fonts", { value: { ready }, configurable: true });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function pageCount(): number {
  return container.querySelectorAll("[data-page]").length;
}

function measured(): string[] {
  const measure = container.querySelector("[data-paper-measure]")!;
  return [...measure.querySelectorAll("[data-keep-id]")].map(
    (element) => element.getAttribute("data-keep-id")!
  );
}

describe("nothing is paginated before the fonts load", () => {
  it("renders no page while document.fonts.ready is pending", () => {
    const onPaginate = vi.fn();
    act(() => {
      root.render(
        <Pages onPaginate={onPaginate}>
          <ProposalDocument data={shortProposalData} />
        </Pages>
      );
    });

    expect(pageCount()).toBe(0);
    expect(onPaginate).not.toHaveBeenCalled();
  });

  it("still renders the whole document into the hidden measuring container", () => {
    act(() => {
      root.render(
        <Pages>
          <ProposalDocument data={shortProposalData} />
        </Pages>
      );
    });

    expect(measured()).toContain("title");
    expect(measured()).toContain("line-items:header");
    expect(measured()).toContain("signature:customer");
  });

  it("paginates as soon as the fonts have loaded", async () => {
    const onPaginate = vi.fn();
    act(() => {
      root.render(
        <Pages onPaginate={onPaginate}>
          <ProposalDocument data={shortProposalData} />
        </Pages>
      );
    });
    expect(pageCount()).toBe(0);

    await act(async () => {
      loadFonts();
    });

    expect(pageCount()).toBeGreaterThan(0);
    expect(onPaginate).toHaveBeenCalled();
    const plan = onPaginate.mock.calls.at(-1)![0] as PagePlan;
    expect(plan.pages).toHaveLength(pageCount());
  });
});

describe("changing the data repaginates", () => {
  it("plans the new document rather than keeping the old plan", async () => {
    const onPaginate = vi.fn();
    const render = (data: typeof shortProposalData) =>
      root.render(
        <Pages onPaginate={onPaginate}>
          <ProposalDocument data={data} />
        </Pages>
      );

    act(() => render(shortProposalData));
    await act(async () => {
      loadFonts();
    });
    const short = onPaginate.mock.calls.at(-1)![0] as PagePlan;

    await act(async () => {
      render(overflowProposalData);
    });
    const overflow = onPaginate.mock.calls.at(-1)![0] as PagePlan;

    expect(overflow).not.toBe(short);
    expect(overflow.pages.flat().length).toBeGreaterThan(short.pages.flat().length);
    expect(overflow.pages.flat()).toContain("line-items:65");
    expect(short.pages.flat()).not.toContain("line-items:65");
  });

  it("does not republish a plan when the document is only re-rendered", async () => {
    const onPaginate = vi.fn();
    const render = () =>
      root.render(
        <Pages onPaginate={onPaginate}>
          <ProposalDocument data={shortProposalData} />
        </Pages>
      );

    act(() => render());
    await act(async () => {
      loadFonts();
    });
    expect(onPaginate).toHaveBeenCalledTimes(1);

    await act(async () => {
      render();
    });
    await act(async () => {
      render();
    });

    expect(onPaginate).toHaveBeenCalledTimes(1);
  });
});

describe("a document with no keeps", () => {
  it("still renders one sheet of paper", async () => {
    act(() => {
      root.render(
        <Pages>
          <p>Nothing here is a pagination unit.</p>
        </Pages>
      );
    });
    await act(async () => {
      loadFonts();
    });

    expect(pageCount()).toBe(1);
    expect(container.querySelector("[data-page]")?.querySelectorAll("[data-keep-id]")).toHaveLength(
      0
    );
  });
});
