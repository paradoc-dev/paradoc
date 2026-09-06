/**
 * The page plan, on stubbed heights.
 *
 * `planPages` is the whole of pagination and it takes numbers, not elements, so
 * the greedy fill, the header repeat, the oversize case and the empty case are
 * all decided here rather than in a browser.
 */

import { describe, expect, it } from "vitest";
import { planPages, type MeasuredKeep } from "../src/lib/plan";

const BUDGET = 960;

/** One keep before it is laid out: a height, and the gap the flow puts above it. */
interface Sized extends Omit<MeasuredKeep, "top" | "bottom"> {
  height: number;
  gap?: number;
}

function keep(id: string, height: number, extra: Partial<Sized> = {}): Sized {
  return { id, height, ...extra };
}

/** Lays keeps out one under another, which is what a plain flow does. */
function stack(...items: Sized[]): MeasuredKeep[] {
  let y = 0;
  return items.map(({ height, gap, ...keep }) => {
    y += gap ?? 0;
    const laid = { ...keep, top: y, bottom: y + height };
    y += height;
    return laid;
  });
}

/** A table header plus `count` rows, all of the same height. */
function table(name: string, count: number, height: number): Sized[] {
  return [
    keep(`${name}:header`, height, { table: name, tableHeader: true }),
    ...Array.from({ length: count }, (_row, index) =>
      keep(`${name}:${index}`, height, { table: name })
    ),
  ];
}

describe("the empty document", () => {
  it("plans no pages at all", () => {
    expect(planPages([], BUDGET)).toEqual({
      pages: [],
      repeats: [],
      sections: [],
      breaks: [],
      oversize: [],
      budget: BUDGET,
    });
  });
});

describe("the plan carries the budget it was filled against", () => {
  it("reports the budget it was given, not a constant", () => {
    expect(planPages(stack(keep("a", 100)), 640).budget).toBe(640);
  });
});

describe("the greedy fill", () => {
  it("keeps keeps on a page while they fit", () => {
    const plan = planPages(stack(keep("a", 400), keep("b", 400)), BUDGET);
    expect(plan.pages).toEqual([["a", "b"]]);
    expect(plan.breaks).toEqual([]);
  });

  it("moves a keep that does not fit to the next page, never splitting it", () => {
    const plan = planPages(stack(keep("a", 400), keep("b", 400), keep("c", 400)), BUDGET);
    expect(plan.pages).toEqual([
      ["a", "b"],
      ["c"],
    ]);
  });

  it("fills a page to the budget exactly", () => {
    const plan = planPages(stack(keep("a", 480), keep("b", 480), keep("c", 1)), BUDGET);
    expect(plan.pages).toEqual([
      ["a", "b"],
      ["c"],
    ]);
  });

  it("counts the gap the flow puts before a keep", () => {
    const tight = planPages(stack(keep("a", 480), keep("b", 480, { gap: 1 })), BUDGET);
    expect(tight.pages).toEqual([["a"], ["b"]]);
  });

  it("counts two keeps laid out side by side as one band, not two", () => {
    const columns: MeasuredKeep[] = [
      { id: "left", top: 0, bottom: 900 },
      { id: "right", top: 0, bottom: 700 },
      { id: "below", top: 900, bottom: 960 },
    ];
    expect(planPages(columns, BUDGET).pages).toEqual([["left", "right", "below"]]);
  });

  it("does not charge a gap to a keep that opens a page", () => {
    const plan = planPages(
      stack(keep("a", 900), keep("b", 900, { gap: 100 }), keep("c", 60)),
      BUDGET
    );
    expect(plan.pages).toEqual([["a"], ["b", "c"]]);
  });

  it("names the keep that starts each page from the second onward", () => {
    const plan = planPages(
      stack(keep("a", 500), keep("b", 500), keep("c", 500), keep("d", 500)),
      BUDGET
    );
    expect(plan.pages).toEqual([["a"], ["b"], ["c"], ["d"]]);
    expect(plan.breaks).toEqual(["b", "c", "d"]);
  });
});

describe("a table header repeats on every continued page", () => {
  const plan = planPages(stack(...table("items", 10, 100)), 500);

  it("marks the copy as a repeat and never as the page's break", () => {
    expect(plan.repeats).toEqual([[], ["items:header"], ["items:header"]]);
    for (const [index, page] of plan.pages.entries()) {
      for (const id of plan.repeats[index]!) expect(page).toContain(id);
    }
  });

  it("charges the copy the gap the flow puts under the header", () => {
    const spaced = planPages(
      stack(keep("items:header", 100, { table: "items", tableHeader: true }),
        keep("items:0", 100, { table: "items", gap: 40 }),
        keep("items:1", 100, { table: "items" }),
        keep("items:2", 100, { table: "items" })),
      340
    );
    // Header 100 plus its 40 pixel gap leaves 200 for rows, so two fit, not three.
    expect(spaced.pages).toEqual([
      ["items:header", "items:0", "items:1"],
      ["items:header", "items:2"],
    ]);
  });

  it("repeats the header at the top of each page after the first", () => {
    expect(plan.pages).toEqual([
      ["items:header", "items:0", "items:1", "items:2", "items:3"],
      ["items:header", "items:4", "items:5", "items:6", "items:7"],
      ["items:header", "items:8", "items:9"],
    ]);
  });

  it("counts the repeated header against the page budget", () => {
    for (const page of plan.pages) {
      expect(page.length * 100).toBeLessThanOrEqual(500);
    }
  });

  it("breaks on the row, not on the copied header", () => {
    expect(plan.breaks).toEqual(["items:4", "items:8"]);
  });

  it("does not repeat the header onto the page the header itself opens", () => {
    const plan = planPages(stack(keep("intro", 300), ...table("items", 3, 100)), 500);
    expect(plan.pages).toEqual([
      ["intro", "items:header", "items:0"],
      ["items:header", "items:1", "items:2"],
    ]);
  });

  it("moves an orphan header forward rather than ending a page with it", () => {
    const plan = planPages(stack(keep("intro", 400), ...table("items", 2, 100)), 500);
    expect(plan.pages).toEqual([
      ["intro"],
      ["items:header", "items:0", "items:1"],
    ]);
    expect(plan.breaks).toEqual(["items:header"]);
  });

  it("keeps the copy and the row together when both fit", () => {
    const plan = planPages(stack(...table("items", 2, 200)), 500);
    expect(plan.pages).toEqual([
      ["items:header", "items:0"],
      ["items:header", "items:1"],
    ]);
    expect(plan.repeats).toEqual([[], ["items:header"]]);
    expect(plan.breaks).toEqual(["items:1"]);
    expect(plan.oversize).toEqual([]);
  });

  it("reports the row when the copy above it leaves no room", () => {
    const plan = planPages(stack(...table("items", 2, 300)), 500);
    // The header opened a page of its own, which the first row then carried it
    // off, so there are two pages and not three.
    expect(plan.pages).toEqual([
      ["items:header", "items:0"],
      ["items:header", "items:1"],
    ]);
    expect(plan.oversize).toEqual([
      { id: "items:0", height: 600 },
      { id: "items:1", height: 600 },
    ]);
  });

  it("carries a header no row ever follows off the foot of a page", () => {
    const plan = planPages(
      stack(
        keep("a", 400),
        keep("items:header", 80, { table: "items", tableHeader: true }),
        keep("b", 400)
      ),
      500
    );
    expect(plan.pages).toEqual([["a"], ["items:header", "b"]]);
    expect(plan.breaks).toEqual(["items:header"]);
    expect(plan.repeats).toEqual([[], []]);
  });

  it("carries a header off the foot of a page an oversize keep follows", () => {
    const plan = planPages(
      stack(
        keep("a", 400),
        keep("items:header", 80, { table: "items", tableHeader: true }),
        keep("giant", 2000)
      ),
      500
    );
    expect(plan.pages).toEqual([["a"], ["items:header", "giant"]]);
    expect(plan.oversize).toEqual([{ id: "giant", height: 2080 }]);
  });

  it("repeats only the header of the table the page opens on", () => {
    const plan = planPages(stack(...table("a", 1, 200), ...table("b", 4, 200)), 500);
    expect(plan.pages[1]).toContain("b:header");
    expect(plan.pages[1]).not.toContain("a:header");
  });
});

describe("a keep taller than a page", () => {
  const plan = planPages(
    stack(keep("before", 200), keep("giant", 1400), keep("after", 200)),
    BUDGET
  );

  it("gets a page of its own that nothing else joins", () => {
    expect(plan.pages).toEqual([["before"], ["giant"], ["after"]]);
  });

  it("is reported with its measured height", () => {
    expect(plan.oversize).toEqual([{ id: "giant", height: 1400 }]);
  });

  it("still repeats the table header above an oversize row", () => {
    const rows = table("items", 2, 100);
    const withGiant = planPages(
      stack(rows[0]!, rows[1]!, keep("giant", 1400, { table: "items" }), rows[2]!),
      BUDGET
    );
    expect(withGiant.pages).toEqual([
      ["items:header", "items:0"],
      ["items:header", "giant"],
      ["items:header", "items:1"],
    ]);
    // The copy is part of what the page spent, so it is part of the report.
    expect(withGiant.oversize).toEqual([{ id: "giant", height: 1500 }]);
  });

  it("reports nothing when every keep fits", () => {
    expect(planPages(stack(keep("a", 100)), BUDGET).oversize).toEqual([]);
  });
});

describe("sections follow their keeps", () => {
  const keeps = stack(
    keep("heading:one", 400, { sections: ["one"] }),
    keep("field:a", 400, { sections: ["one"] }),
    keep("heading:two", 400, { sections: ["two"] }),
    keep("field:b", 400, { sections: ["two"] })
  );

  it("lists a section on every page that holds one of its keeps", () => {
    const plan = planPages(keeps, BUDGET);
    expect(plan.pages).toEqual([
      ["heading:one", "field:a"],
      ["heading:two", "field:b"],
    ]);
    expect(plan.sections).toEqual([["one"], ["two"]]);
  });

  it("keeps a section on both pages when its keeps straddle a break", () => {
    const plan = planPages(
      stack(
        keep("heading:one", 600, { sections: ["one"] }),
        keep("field:a", 600, { sections: ["one"] })
      ),
      BUDGET
    );
    expect(plan.sections).toEqual([["one"], ["one"]]);
  });

  it("lists nesting outermost first, without repeats", () => {
    const plan = planPages(
      stack(
        keep("field:a", 100, { sections: ["outer", "inner"] }),
        keep("field:b", 100, { sections: ["outer", "inner"] })
      ),
      BUDGET
    );
    expect(plan.sections).toEqual([["outer", "inner"]]);
  });

  it("gives a keep with no section an empty list", () => {
    expect(planPages(stack(keep("a", 100)), BUDGET).sections).toEqual([[]]);
  });
});
