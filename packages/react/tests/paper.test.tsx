// @vitest-environment jsdom
/**
 * `Paper` under a real DOM.
 *
 * jsdom has no layout engine, so the container width and the sheet height are
 * stubbed and the ResizeObserver is driven by hand. What is under test is the
 * part that has to be right: the sheet keeps its 816 pixel width at every
 * container width, and only the transform changes.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Paper, PAPER_WIDTH_PX } from "../src/components/paper";

/** Every observer the component under test created, so the test can drive them. */
let observers: Array<() => void> = [];

class StubResizeObserver {
  constructor(private readonly callback: () => void) {
    observers.push(() => this.callback());
  }
  observe() {}
  disconnect() {}
}

/** jsdom reports 0 for every measured box, so the test supplies the numbers. */
function stubSize(element: Element, { clientWidth, scrollHeight }: { clientWidth?: number; scrollHeight?: number }) {
  if (clientWidth !== undefined) {
    Object.defineProperty(element, "clientWidth", { value: clientWidth, configurable: true });
  }
  if (scrollHeight !== undefined) {
    Object.defineProperty(element, "scrollHeight", { value: scrollHeight, configurable: true });
  }
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = StubResizeObserver as unknown as typeof ResizeObserver;
  observers = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** Mounts a sheet whose container is `width` wide, and returns the sheet element. */
function mountAt(width: number, contentHeight = 1200): HTMLElement {
  act(() => {
    root.render(
      <Paper>
        <p>content</p>
      </Paper>
    );
  });
  const sheet = container.querySelector<HTMLElement>("[data-paper-sheet]")!;
  stubSize(sheet.parentElement!.parentElement!, { clientWidth: width });
  stubSize(sheet, { scrollHeight: contentHeight });
  act(() => {
    for (const notify of observers) notify();
  });
  return sheet;
}

function scaleOf(sheet: HTMLElement): number {
  const match = /scale\(([\d.]+)\)/.exec(sheet.style.transform);
  expect(match, `no scale in "${sheet.style.transform}"`).not.toBeNull();
  return Number(match![1]);
}

describe("Paper", () => {
  it("holds the sheet at US Letter width whatever the container is", () => {
    for (const width of [1440, 900, 620, 320]) {
      const sheet = mountAt(width);
      expect(sheet.style.width).toBe(`${PAPER_WIDTH_PX}px`);
      act(() => root.unmount());
      root = createRoot(container);
      observers = [];
    }
  });

  it("scales down to fit a container narrower than the sheet", () => {
    const sheet = mountAt(612);
    expect(scaleOf(sheet)).toBeCloseTo(612 / PAPER_WIDTH_PX, 5);
    expect(sheet.style.width).toBe(`${PAPER_WIDTH_PX}px`);
  });

  it("never scales up past 1 in a container wider than the sheet", () => {
    const sheet = mountAt(1600);
    expect(scaleOf(sheet)).toBe(1);
  });

  it("changes only the transform when the container narrows", () => {
    const sheet = mountAt(1200);
    const wide = { width: sheet.style.width, padding: sheet.style.padding, minHeight: sheet.style.minHeight };
    expect(scaleOf(sheet)).toBe(1);

    stubSize(sheet.parentElement!.parentElement!, { clientWidth: 408 });
    act(() => {
      for (const notify of observers) notify();
    });

    expect(scaleOf(sheet)).toBeCloseTo(0.5, 5);
    expect(sheet.style.width).toBe(wide.width);
    expect(sheet.style.padding).toBe(wide.padding);
    expect(sheet.style.minHeight).toBe(wide.minHeight);
  });

  it("reserves the scaled height so the sheet does not overlap what follows", () => {
    const sheet = mountAt(408, 2000);
    const holder = sheet.parentElement!;
    expect(holder.style.height).toBe(`${2000 * 0.5}px`);
    expect(holder.className).toContain("mx-auto");
  });
});
