import { createFormatter } from "@paradoc/format";
// @vitest-environment jsdom
/**
 * The plan survives an equal re-render.
 *
 * The host here is the lab's own: it keeps the plan in state, sets it from
 * `onPaginate`, and writes its props as inline literals, so every render hands
 * `Pages` a brand new element tree and a brand new callback. Nothing about the
 * document changed, and nothing about the preview may change either: no new
 * plan, no republished plan, and the same sheet elements in the DOM.
 *
 * A `Pages` that read prop identity would call that a new document, drop its
 * plan, unmount every sheet, plan again, publish again, and never stop. That
 * loop starves the event loop, so a timeout alone would never fire: the host
 * carries a render budget and throws when it is spent, and the timeout is only
 * there for a hang that is not the host's own.
 *
 * jsdom has no layout engine, so every keep measures zero and the plan is one
 * page. What is under test is which measurements produce a new plan, not the
 * arithmetic; that is `plan.test.ts`.
 */

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Pages } from "../../components/src/components/pages";
import { ProposalDocument, overflowProposalData, shortProposalData } from "../../components/src/examples";
import type { PagePlan } from "../src/lib/plan";

/** Generous for work that settles in milliseconds. */
const TIMEOUT_MS = 10_000;

/** More host renders than any settling preview needs, and far fewer than a loop. */
const RENDER_BUDGET = 8;

/**
 * A render budget the host spends.
 *
 * A looping preview never yields, so nothing outside the render can notice it.
 * Throwing from inside the render is what turns the loop into a test failure.
 */
function renderBudget() {
  let spent = 0;
  return {
    spend() {
      spent += 1;
      if (spent > RENDER_BUDGET) {
        throw new Error(`the host rendered more than ${RENDER_BUDGET} times: the preview is looping`);
      }
    },
    get spent() {
      return spent;
    },
  };
}

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

interface HostProps {
  data: typeof shortProposalData;
  /** Called with every plan the preview publishes. */
  onPaginate: (plan: PagePlan) => void;
  /** Spent once per host render, to bound the work an equal re-render costs. */
  onRender: () => void;
}

function Host({ data, onPaginate, onRender }: HostProps) {
  // The lab keeps the plan itself, which is the point: a plan is a fresh object,
  // so a host that is handed a new one on every render never settles.
  const [plan, setPlan] = useState<PagePlan | null>(null);
  onRender();

  return (
    <div data-host-pages={plan?.pages.length ?? 0}>
      <Pages
        onPaginate={(next) => {
          setPlan(next);
          onPaginate(next);
        }}
      >
        <ProposalDocument data={data} format={{ formatter: createFormatter({ locale: "en-US" }) }} />
      </Pages>
    </div>
  );
}

/** The sheet elements themselves, so a remount is visible as new nodes. */
function sheets(): Element[] {
  return [...container.querySelectorAll("[data-page]")];
}

/**
 * The sheets are the same elements, by reference.
 *
 * Structural equality would not do: a remount produces identical markup, which
 * is exactly what this has to tell apart.
 */
function expectSameSheets(actual: Element[], expected: Element[]): void {
  expect(actual).toHaveLength(expected.length);
  for (const [index, sheet] of expected.entries()) expect(actual[index]).toBe(sheet);
}

describe("a host that sets state from onPaginate and passes inline props", () => {
  it(
    "settles: one plan, published once, after a bounded number of renders",
    async () => {
      const onPaginate = vi.fn();
      const renders = renderBudget();

      act(() => {
        root.render(
          <Host data={shortProposalData} onPaginate={onPaginate} onRender={renders.spend} />
        );
      });
      await act(async () => {
        loadFonts();
      });

      expect(sheets()).toHaveLength(1);
      expect(onPaginate).toHaveBeenCalledTimes(1);
      // Two renders is the honest count: the first, and the one that takes the
      // plan. The bound is what matters; a loop spends the budget instead.
      expect(renders.spent).toBeLessThanOrEqual(4);
      expect(container.querySelector("[data-host-pages]")?.getAttribute("data-host-pages")).toBe(
        "1"
      );
    },
    TIMEOUT_MS
  );

  it(
    "keeps the plan and the sheet elements across further equal renders",
    async () => {
      const onPaginate = vi.fn();
      const renders = renderBudget();
      const render = () =>
        root.render(
          <Host data={shortProposalData} onPaginate={onPaginate} onRender={renders.spend} />
        );

      act(render);
      await act(async () => {
        loadFonts();
      });
      const planted = sheets();
      const settled = renders.spent;

      await act(async () => {
        render();
      });
      await act(async () => {
        render();
      });

      expect(onPaginate).toHaveBeenCalledTimes(1);
      expectSameSheets(sheets(), planted);
      // Two more host renders, both asked for from outside; neither cost a third.
      expect(renders.spent).toBe(settled + 2);
    },
    TIMEOUT_MS
  );
});

describe("a genuine change", () => {
  it(
    "repaginates once and leaves the surviving sheet mounted",
    async () => {
      const onPaginate = vi.fn();
      const renders = renderBudget();
      const render = (data: typeof shortProposalData) =>
        root.render(<Host data={data} onPaginate={onPaginate} onRender={renders.spend} />);

      act(() => render(shortProposalData));
      await act(async () => {
        loadFonts();
      });
      const short = onPaginate.mock.calls.at(-1)![0] as PagePlan;
      const planted = sheets();

      await act(async () => {
        render(overflowProposalData);
      });

      expect(onPaginate).toHaveBeenCalledTimes(2);
      const overflow = onPaginate.mock.calls.at(-1)![0] as PagePlan;
      expect(overflow).not.toBe(short);
      expect(overflow.pages.flat()).toContain("line-items:65");
      expect(short.pages.flat()).not.toContain("line-items:65");
      // The document changed, the page it sits on did not, so the sheet is the
      // same element with new content rather than a new element.
      expectSameSheets(sheets(), planted);
      expect(sheets()[0]!.querySelector('[data-keep-id="line-items:65"]')).not.toBeNull();
    },
    TIMEOUT_MS
  );
});
