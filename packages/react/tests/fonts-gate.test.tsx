// @vitest-environment jsdom
/**
 * The fonts gate, and repagination.
 *
 * Page breaks computed against a fallback face are wrong the moment the real
 * face arrives, so `Pages` renders no page at all until the faces the document
 * is set in have loaded. jsdom loads no fonts, so the test owns the font set
 * and decides when each promise settles.
 *
 * **The gate is `document.fonts.load`, not `document.fonts.ready`.** `ready` is
 * a promise about the faces the page has already asked for, so on a cold page
 * it is already resolved before layout requests a single glyph, and a gate
 * behind it opens onto the fallback. That is the race this file's third
 * describe block pins down: `ready` resolved, the face still loading, and no
 * plan measured.
 *
 * jsdom also has no layout engine: every keep measures zero, so the plan that
 * comes out is one page. What is under test here is the gate and the
 * repagination, not the arithmetic — that is `plan.test.ts`.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Pages } from "../src/components/pages";
import {
  scriptProbeText,
  ARABIC_FONT_NAME,
  DOCUMENT_FONT_NAME,
  DOCUMENT_FONT_WEIGHTS,
} from "../src/lib/font";
import type { PagePlan } from "../src/lib/plan";
import {
  arabicLetterData,
  ArabicLetterDocument,
  arabicLetterTokens,
  brandedProposalTokens,
  ProposalDocument,
  overflowProposalData,
  shortProposalData,
} from "../src/examples";

let container: HTMLDivElement;
let root: Root;
let loadFonts: () => void;
/** Every face `Pages` asked the font set to load: its shorthand and its text. */
let requested: { font: string; text: string }[];

/**
 * Replaces the font set with one the test settles by hand.
 *
 * Both halves are stubbed, because both are the gate: `check` says the face is
 * not there yet, `load` is the promise that says when it is, and `ready` is
 * awaited afterwards. `loadFonts` settles both, so a test that only cares that
 * the fonts arrived does not have to know which one it is waiting on.
 *
 * The stub records the *text* each request carried as well as the shorthand,
 * because the text is what decides which faces of a family the browser loads
 * and it is the half that was wrong: a request with the default text asks only
 * for whichever face covers a space.
 */
function pendingFonts({ readyNow = false }: { readyNow?: boolean } = {}): void {
  requested = [];
  let settle: () => void;
  const loaded = new Promise<void>((resolve) => {
    settle = resolve;
  });
  const ready = readyNow ? Promise.resolve() : loaded;
  loadFonts = () => settle();
  Object.defineProperty(document, "fonts", {
    value: {
      ready,
      check: () => false,
      load: (font: string, text: string) => {
        requested.push({ font, text });
        return loaded.then(() => []);
      },
    },
    configurable: true,
  });
}

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  pendingFonts();

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
  it("renders no page while the document's own faces are still loading", () => {
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

describe("a resolved document.fonts.ready is not a loaded face", () => {
  it("measures no plan until the face itself has loaded", async () => {
    // The cold-runner race, exactly. `ready` is a promise about the faces the
    // page has already asked for; on a page that has asked for none it is
    // resolved immediately, so a gate that waited on it alone would measure the
    // whole document against whatever the browser falls back to. This is what
    // turned the parity job red on a cold CI runner while every local run
    // passed: page 1's ink came out 7.73% against the 6.40% the same document
    // measures once the face is there.
    pendingFonts({ readyNow: true });
    const onPaginate = vi.fn();

    act(() => {
      root.render(
        <Pages onPaginate={onPaginate}>
          <ProposalDocument data={shortProposalData} />
        </Pages>
      );
    });
    // Let `document.fonts.ready` settle. Nothing else has.
    await act(async () => {
      await Promise.resolve();
    });

    expect(pageCount()).toBe(0);
    expect(onPaginate).not.toHaveBeenCalled();

    await act(async () => {
      loadFonts();
    });

    expect(pageCount()).toBeGreaterThan(0);
    expect(onPaginate).toHaveBeenCalled();
  });

  it("asks for the family the document is set in, at the weights it uses", async () => {
    pendingFonts({ readyNow: true });
    act(() => {
      root.render(
        <Pages>
          <ProposalDocument data={shortProposalData} />
        </Pages>
      );
    });
    await act(async () => {
      loadFonts();
    });

    // Named faces, not the font set: a weight the components use and the gate
    // does not name is a weight the plan is measured without.
    expect(requested.map((request) => request.font)).toEqual(
      DOCUMENT_FONT_WEIGHTS.map((weight) => `${weight} 16px "Inter Variable"`)
    );
  });

  it("asks for a letter of every script the family carries, not for a space", async () => {
    // `document.fonts.load` defaults its text to a single space. A fontsource
    // family is one face per subset with its own `unicode-range`, so a space is
    // answered by the Latin face alone and every other face stays unloaded —
    // which for the Arabic family is the only face that matters. The probe
    // therefore names a letter per declared script.
    pendingFonts({ readyNow: true });
    act(() => {
      root.render(
        <Pages>
          <ArabicLetterDocument data={arabicLetterData} tokens={arabicLetterTokens} />
        </Pages>
      );
    });
    await act(async () => {
      loadFonts();
    });

    expect(requested.map((request) => request.font)).toEqual(
      DOCUMENT_FONT_WEIGHTS.map((weight) => `${weight} 16px "Noto Sans Arabic Variable"`)
    );
    for (const request of requested) {
      // U+0627 ARABIC LETTER ALEF: the Arabic face is what this document is
      // measured against, and nothing else in the probe would reach it.
      expect(request.text).toContain("\u0627");
      expect(request.text).toBe(scriptProbeText(ARABIC_FONT_NAME));
    }
    // The Latin family asks for no Arabic, because it carries none.
    expect(scriptProbeText(DOCUMENT_FONT_NAME)).not.toContain("\u0627");
  });

  it("asks for nothing it already has", async () => {
    pendingFonts({ readyNow: true });
    (document.fonts as FontFaceSet).check = () => true;
    const onPaginate = vi.fn();

    act(() => {
      root.render(
        <Pages onPaginate={onPaginate}>
          <ProposalDocument data={shortProposalData} />
        </Pages>
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(requested).toEqual([]);
    expect(onPaginate).toHaveBeenCalled();
  });
});

describe("changing the typeface waits for the fonts again", () => {
  it("measures no plan until the family it is now set in has loaded", async () => {
    const onPaginate = vi.fn();
    const render = (tokens?: typeof brandedProposalTokens) =>
      root.render(
        <Pages onPaginate={onPaginate}>
          <ProposalDocument data={shortProposalData} tokens={tokens} />
        </Pages>
      );

    act(() => render());
    await act(async () => {
      loadFonts();
    });
    expect(onPaginate).toHaveBeenCalled();
    const measured = onPaginate.mock.calls.length;

    // The serif is a family the browser has not been asked for yet, so the wait
    // starts over. The plan already on screen stays — dropping it would unmount
    // every sheet — but no new one is measured, because a plan measured against
    // whatever the serif falls back to is a plan of a document nobody will see.
    pendingFonts({ readyNow: true });
    await act(async () => {
      render(brandedProposalTokens);
    });
    expect(onPaginate).toHaveBeenCalledTimes(measured);

    await act(async () => {
      loadFonts();
    });
    expect(pageCount()).toBeGreaterThan(0);
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
