// @vitest-environment jsdom
/**
 * Tenant branding on the preview side.
 *
 * Tokens are declared on the document root and have to reach two places that
 * are not below it: the sheet the page furniture draws, and the render that
 * overrides them. Both are checked here against a real DOM, because the paper
 * arrives through a layout effect and a static render would never run it.
 *
 * jsdom has no layout engine, so nothing here asserts a page break. What is
 * under test is which paper the sheet is, which family the browser is pointed
 * at, and where the accent and the mark land.
 */

import { act, memo } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Bundle } from "../src/components/bundle";
import { Document } from "../src/components/document";
import { Pages } from "../src/components/pages";
import { Paper } from "../src/components/paper";
import { Section } from "../src/components/section";
import {
  NestedPaperTokenError,
  RootTokenMismatchError,
  TokenOverrideProvider,
} from "../src/components/tokens-context";
import { Totals } from "../src/components/totals";
import {
  brandedProposalTokens,
  proposalForm,
  ProposalDocument,
  shortProposalData,
  BRANDED_ACCENT_COLOR,
} from "../src/examples";
import {
  documentTokensOf,
  MultipleDocumentRootsError,
} from "../src/lib/document-tokens";
import { SERIF_FONT_NAME, UnregisteredFontFamilyError } from "../src/lib/font";
import {
  isCssColor,
  pageGeometry,
  resolveDocumentTokens,
  sameDocumentTokens,
  DEFAULT_DOCUMENT_TOKENS,
  DOCUMENT_TOKEN_KEYS,
  InvalidDocumentTokenError,
  PAGE_SIZES,
} from "../src/lib/tokens";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // `Pages` measures nothing until the fonts are in, and jsdom loads none.
  Object.defineProperty(document, "fonts", { value: { ready: Promise.resolve() }, configurable: true });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/**
 * Mounts a tree and returns the first sheet the furniture drew.
 *
 * Awaited, because `Pages` draws no page until `document.fonts.ready` settles
 * and that is a microtask however immediately it resolves.
 */
async function mount(tree: React.ReactElement): Promise<HTMLElement> {
  await act(async () => {
    root.render(tree);
  });
  const sheet = container.querySelector<HTMLElement>("[data-paper-sheet]");
  expect(sheet, "the furniture drew no sheet").not.toBeNull();
  return sheet!;
}

describe("resolving a token set", () => {
  it("defaults to the document this package rendered before there were tokens", () => {
    expect(resolveDocumentTokens()).toEqual(DEFAULT_DOCUMENT_TOKENS);
    expect(DEFAULT_DOCUMENT_TOKENS.pageSize).toBe("letter");
    expect(DEFAULT_DOCUMENT_TOKENS.marginPx).toBe(48);
    expect(DEFAULT_DOCUMENT_TOKENS.accentColor).toBeUndefined();
    expect(DEFAULT_DOCUMENT_TOKENS.logo).toBeUndefined();
    expect(pageGeometry(DEFAULT_DOCUMENT_TOKENS)).toEqual({
      widthPx: 816,
      heightPx: 1056,
      marginPx: 48,
      contentHeightPx: 960,
      contentWidthPx: 720,
    });
  });

  it("layers later sets over earlier ones field by field", () => {
    const resolved = resolveDocumentTokens(
      { pageSize: "a4", accentColor: "#111111" },
      { accentColor: "#222222" }
    );
    expect(resolved.pageSize).toBe("a4");
    expect(resolved.accentColor).toBe("#222222");
    expect(resolved.fontFamily).toBe(DEFAULT_DOCUMENT_TOKENS.fontFamily);
  });

  it("gives A4 the geometry the margin leaves", () => {
    const resolved = resolveDocumentTokens({ pageSize: "a4", marginPx: 56 });
    expect(pageGeometry(resolved)).toEqual({
      ...PAGE_SIZES.a4,
      marginPx: 56,
      contentHeightPx: PAGE_SIZES.a4.heightPx - 112,
      contentWidthPx: PAGE_SIZES.a4.widthPx - 112,
    });
  });

  it("encodes logo bytes as a source both outputs can read", () => {
    const resolved = resolveDocumentTokens({ logo: brandedProposalTokens.logo });
    expect(resolved.logo).toMatch(/^data:image\/png;base64,/);
  });

  it("refuses a family it carries no files for, naming it and the ones it has", () => {
    expect(() => resolveDocumentTokens({ fontFamily: "Comic Sans MS" })).toThrow(
      UnregisteredFontFamilyError
    );
    try {
      resolveDocumentTokens({ fontFamily: "Comic Sans MS" });
    } catch (error) {
      const failure = error as UnregisteredFontFamilyError;
      expect(failure.family).toBe("Comic Sans MS");
      expect(failure.message).toContain("Comic Sans MS");
      expect(failure.message).toContain(DEFAULT_DOCUMENT_TOKENS.fontFamily);
      expect(failure.message).toContain(SERIF_FONT_NAME);
    }
    expect.assertions(5);
  });
});

describe("the paper the document chose reaches the furniture above it", () => {
  it("draws the unbranded document on US Letter", async () => {
    const sheet = await mount(
      <Pages>
        <ProposalDocument data={shortProposalData} />
      </Pages>
    );
    expect(sheet.style.width).toBe("816px");
    expect(sheet.style.minHeight).toBe("1056px");
    expect(sheet.style.padding).toBe("48px");
  });

  it("draws a branded document on its own paper, in `Pages`", async () => {
    const sheet = await mount(
      <Pages>
        <ProposalDocument data={shortProposalData} tokens={brandedProposalTokens} />
      </Pages>
    );
    expect(sheet.style.width).toBe(`${PAGE_SIZES.a4.widthPx}px`);
    expect(sheet.style.minHeight).toBe(`${PAGE_SIZES.a4.heightPx}px`);
    expect(sheet.style.padding).toBe("56px");
  });

  it("draws a branded document on its own paper, in `Paper`", async () => {
    const sheet = await mount(
      <Paper>
        <ProposalDocument data={shortProposalData} tokens={brandedProposalTokens} />
      </Paper>
    );
    expect(sheet.style.width).toBe(`${PAGE_SIZES.a4.widthPx}px`);
    expect(sheet.style.padding).toBe("56px");
  });

  it("measures the branded document at the width its own margin leaves", async () => {
    await mount(
      <Pages>
        <ProposalDocument data={shortProposalData} tokens={brandedProposalTokens} />
      </Pages>
    );
    const measure = container.querySelector<HTMLElement>("[data-paper-measure]")!;
    expect(measure.style.width).toBe(`${PAGE_SIZES.a4.widthPx - 112}px`);
  });
});

describe("the typeface", () => {
  it("points the browser at the family the document names", async () => {
    await mount(
      <Pages>
        <ProposalDocument data={shortProposalData} tokens={brandedProposalTokens} />
      </Pages>
    );
    const stack = container
      .querySelector<HTMLElement>("[data-page-stack]")!
      .style.getPropertyValue("--paradoc-font-family");
    expect(stack).toContain(SERIF_FONT_NAME);
  });

  it("points it at the default family when the document names none", async () => {
    await mount(
      <Pages>
        <ProposalDocument data={shortProposalData} />
      </Pages>
    );
    const stack = container
      .querySelector<HTMLElement>("[data-page-stack]")!
      .style.getPropertyValue("--paradoc-font-family");
    expect(stack).toContain(DEFAULT_DOCUMENT_TOKENS.fontFamily);
    expect(stack).not.toContain(SERIF_FONT_NAME);
  });

  it("is carried on the document root as well, for a document shown without furniture", () => {
    const markup = renderToStaticMarkup(
      <ProposalDocument data={shortProposalData} tokens={brandedProposalTokens} />
    );
    expect(markup).toContain(SERIF_FONT_NAME);
  });
});

describe("the accent", () => {
  it("colours a section heading and the emphasised total", () => {
    const markup = renderToStaticMarkup(
      <ProposalDocument data={shortProposalData} tokens={brandedProposalTokens} />
    );
    const host = document.createElement("div");
    host.innerHTML = markup;

    const heading = host.querySelector<HTMLElement>('[data-keep-id="heading:summary"]')!;
    expect(heading.style.color).not.toBe("");
    expect(heading.getAttribute("style")).toContain(BRANDED_ACCENT_COLOR);

    const total = host.querySelector<HTMLElement>('[data-def="total"]')!;
    expect(total.getAttribute("style")).toContain(BRANDED_ACCENT_COLOR);
  });

  it("leaves the unbranded document its neutral palette", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(<ProposalDocument data={shortProposalData} />);
    expect(
      host.querySelector<HTMLElement>('[data-keep-id="heading:summary"]')!.getAttribute("style")
    ).toBeNull();
    expect(host.querySelector<HTMLElement>('[data-def="total"]')!.getAttribute("style")).toBeNull();
  });

  it("reaches a bare `Section` and `Totals` through the document that carries the tokens", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(
      <Document artifact={proposalForm} data={shortProposalData} tokens={{ accentColor: "#0f766e" }}>
        <Section id="only" title="Only">
          <Totals rows={[{ def: "total", emphasis: true }]} />
        </Section>
      </Document>
    );
    expect(
      host.querySelector<HTMLElement>('[data-keep-id="heading:only"]')!.getAttribute("style")
    ).toContain("#0f766e");
    expect(host.querySelector<HTMLElement>('[data-def="total"]')!.getAttribute("style")).toContain(
      "#0f766e"
    );
  });
});

describe("the mark", () => {
  it("replaces the sample's own mark with the tenant's", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(
      <ProposalDocument data={shortProposalData} tokens={brandedProposalTokens} />
    );
    expect(host.querySelector('[data-keep-id="logo"]')!.getAttribute("src")).toMatch(
      /^data:image\/png;base64,/
    );
  });

  it("leaves the sample's own mark when the tokens carry none", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(<ProposalDocument data={shortProposalData} />);
    expect(host.querySelector('[data-keep-id="logo"]')!.getAttribute("src")).toBe(
      "paradoc-react:proposal-logo.png"
    );
  });
});

describe("a bundle brands every document in it", () => {
  it("hands its tokens down, and a document may layer one of its own on top", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(
      <Bundle tokens={{ accentColor: "#0f766e", pageSize: "a4" }}>
        <Document
          artifact={proposalForm}
          data={shortProposalData}
          tokens={{ accentColor: "#b91c1c" }}
          id="second"
        >
          <Section id="only" title="Only">
            <Totals rows={[{ def: "total", emphasis: true }]} />
          </Section>
        </Document>
      </Bundle>
    );
    expect(
      host.querySelector<HTMLElement>('[data-keep-id="heading:only"]')!.getAttribute("style")
    ).toContain("#b91c1c");
  });

  it("draws the whole sequence on the paper the bundle chose", async () => {
    const sheet = await mount(
      <Pages>
        <Bundle tokens={{ pageSize: "a4" }}>
          <Document artifact={proposalForm} data={shortProposalData} id="only">
            <Section id="only" title="Only">
              <Totals rows={[{ def: "total" }]} />
            </Section>
          </Document>
        </Bundle>
      </Pages>
    );
    expect(sheet.style.width).toBe(`${PAGE_SIZES.a4.widthPx}px`);
  });
});

describe("a render overrides the document's own tokens", () => {
  it("wins over what the document declared, field by field, from above the furniture", async () => {
    const sheet = await mount(
      <TokenOverrideProvider tokens={{ pageSize: "letter" }}>
        <Pages>
          <ProposalDocument data={shortProposalData} tokens={brandedProposalTokens} />
        </Pages>
      </TokenOverrideProvider>
    );
    expect(sheet.style.width).toBe("816px");
    // The override named only the paper, so the document keeps its own margin.
    expect(sheet.style.padding).toBe("56px");
  });

  it("is honoured between the furniture and the document too", async () => {
    const sheet = await mount(
      <Pages>
        <TokenOverrideProvider tokens={{ pageSize: "letter" }}>
          <ProposalDocument data={shortProposalData} tokens={brandedProposalTokens} />
        </TokenOverrideProvider>
      </Pages>
    );
    expect(sheet.style.width).toBe("816px");
    expect(sheet.style.padding).toBe("56px");
  });
});

describe("the paper is resolved from the element, so a static render has it", () => {
  it("draws `Paper` around a branded document on the branded paper", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(
      <Paper>
        <ProposalDocument data={shortProposalData} tokens={brandedProposalTokens} />
      </Paper>
    );
    const sheet = host.querySelector<HTMLElement>("[data-paper-sheet]")!;
    expect(sheet.getAttribute("data-page-size")).toBe(
      `${PAGE_SIZES.a4.widthPx}x${PAGE_SIZES.a4.heightPx}`
    );
    expect(sheet.getAttribute("style")).toContain(`width:${PAGE_SIZES.a4.widthPx}px`);
    expect(sheet.getAttribute("style")).toContain("padding:56px");
    expect(sheet.getAttribute("style")).toContain(SERIF_FONT_NAME);
  });

  it("refuses two document roots under one preview, naming the rule", () => {
    const two = (
      <>
        <Document artifact={proposalForm} data={shortProposalData} id="one">
          <Section id="a" title="A">
            <Totals rows={[{ def: "total" }]} />
          </Section>
        </Document>
        <Document artifact={proposalForm} data={shortProposalData} id="two">
          <Section id="b" title="B">
            <Totals rows={[{ def: "total" }]} />
          </Section>
        </Document>
      </>
    );
    expect(() => documentTokensOf(two)).toThrow(MultipleDocumentRootsError);
    expect(() => documentTokensOf(two)).toThrow(/<Bundle>/);
    expect(() => renderToStaticMarkup(<Paper>{two}</Paper>)).toThrow(MultipleDocumentRootsError);
  });

  it.each([
    ["pageSize", { pageSize: "a4" } as const],
    ["fontFamily", { fontFamily: SERIF_FONT_NAME }],
    ["marginPx", { marginPx: 72 }],
  ])("fails loudly when a composition hides %s from the furniture", (token, hidden) => {
    // The walk never calls a component, so a composition that brands itself
    // internally is invisible to the sheet. The document catches it rather than
    // letting the preview and the PDF drift apart. The typeface matters most:
    // a serif nobody above heard about gives a preview in the serif whose plan
    // was measured in Inter.
    function SelfBranded() {
      return (
        <Bundle tokens={hidden}>
          <Document artifact={proposalForm} data={shortProposalData} id="hidden">
            <Section id="a" title="A">
              <Totals rows={[{ def: "total" }]} />
            </Section>
          </Document>
        </Bundle>
      );
    }
    const draw = () => renderToStaticMarkup(<Paper><SelfBranded /></Paper>);
    expect(draw).toThrow(RootTokenMismatchError);
    expect(draw).toThrow(new RegExp(token));
  });

  it("sees through a wrapper that only passes its children along", () => {
    // An error boundary, a memo, someone else's provider: the walk reads the
    // children they were given, which are already-built elements.
    const Wrapper = ({ children }: { children: React.ReactNode }) => <>{children}</>;
    const Memoized = memo(Wrapper);
    for (const Outer of [Wrapper, Memoized]) {
      expect(
        documentTokensOf(
          <Outer>
            <div>
              <ProposalDocument data={shortProposalData} tokens={brandedProposalTokens} />
            </div>
          </Outer>
        ).pageSize
      ).toBe("a4");
    }
  });

  it("does not mistake an unrelated `tokens` prop for a document's branding", () => {
    const Themed = (_props: { tokens: { spacing: number[]; palette: string } }) => null;
    expect(
      documentTokensOf(
        <div>
          <Themed tokens={{ spacing: [4, 8], palette: "warm" }} />
          <ProposalDocument data={shortProposalData} tokens={brandedProposalTokens} />
        </div>
      ).pageSize
    ).toBe("a4");
  });

  it("counts a bundle of several documents as one root", async () => {
    const sheet = await mount(
      <Pages>
        <Bundle tokens={{ pageSize: "a4" }}>
          <Document artifact={proposalForm} data={shortProposalData} id="first">
            <Section id="a" title="A">
              <Totals rows={[{ def: "total" }]} />
            </Section>
          </Document>
          <Document artifact={proposalForm} data={shortProposalData} id="second">
            <Section id="b" title="B">
              <Totals rows={[{ def: "total" }]} />
            </Section>
          </Document>
        </Bundle>
      </Pages>
    );
    expect(sheet.style.width).toBe(`${PAGE_SIZES.a4.widthPx}px`);
    expect(container.querySelectorAll("[data-document-id]").length).toBeGreaterThan(1);
  });

  it("ignores an override on a branch that holds no document root", () => {
    expect(
      documentTokensOf(
        <div>
          <TokenOverrideProvider tokens={{ pageSize: "a4" }}>
            <p>not a document</p>
          </TokenOverrideProvider>
          <ProposalDocument data={shortProposalData} />
        </div>
      ).pageSize
    ).toBe("letter");
  });
});

describe("paper and typeface are declared once, at the root", () => {
  /** One nested document that sets `token`. */
  function nested(tokens: Record<string, unknown>) {
    return (
      <Bundle>
        <Document
          artifact={proposalForm}
          data={shortProposalData}
          tokens={tokens}
          id="nested"
        >
          <Section id="only" title="Only">
            <Totals rows={[{ def: "total", emphasis: true }]} />
          </Section>
        </Document>
      </Bundle>
    );
  }

  it.each([
    ["fontFamily", { fontFamily: SERIF_FONT_NAME }],
    ["pageSize", { pageSize: "a4" }],
    ["marginPx", { marginPx: 72 }],
  ])("refuses a nested document that sets %s, naming the token", (token, tokens) => {
    expect(() => renderToStaticMarkup(nested(tokens))).toThrow(NestedPaperTokenError);
    expect(() => renderToStaticMarkup(nested(tokens))).toThrow(new RegExp(token));
  });

  it.each([
    ["accentColor", { accentColor: "#0f766e" }],
    ["logo", { logo: "https://example.test/mark.png" }],
  ])("lets a nested document set %s", (_token, tokens) => {
    expect(() => renderToStaticMarkup(nested(tokens))).not.toThrow();
  });
});

describe("every token is checked before a renderer sees it", () => {
  it("refuses an accent that is not a colour, naming the token", () => {
    expect(() => resolveDocumentTokens({ accentColor: "not-a-colour" })).toThrow(
      InvalidDocumentTokenError
    );
    expect(() => resolveDocumentTokens({ accentColor: "not-a-colour" })).toThrow(/accentColor/);
  });

  it("accepts the colour notations a renderer parses", () => {
    for (const colour of ["#fff", "#ffff", "#7c2d12", "#7c2d12ff", "rgb(1 2 3)", "rgba(1,2,3,.5)", "hsl(200 50% 50%)", "oklch(0.7 0.1 20)", "rebeccapurple", "red", "transparent"]) {
      expect(isCssColor(colour), colour).toBe(true);
    }
    for (const colour of ["not-a-colour", "", "   ", "#12345", "rgb(", "javascript:alert(1)"]) {
      expect(isCssColor(colour), colour).toBe(false);
    }
  });

  it("refuses a page size outside the union, which is how one arrives from a database", () => {
    const fromDatabase = { pageSize: "foolscap" } as unknown as { pageSize: "a4" };
    expect(() => resolveDocumentTokens(fromDatabase)).toThrow(InvalidDocumentTokenError);
    expect(() => resolveDocumentTokens(fromDatabase)).toThrow(/pageSize/);
  });

  it("refuses a margin that is not a whole number of pixels at or above zero", () => {
    for (const marginPx of [-1, 12.5, Number.NaN]) {
      expect(() => resolveDocumentTokens({ marginPx })).toThrow(InvalidDocumentTokenError);
      expect(() => resolveDocumentTokens({ marginPx })).toThrow(/marginPx/);
    }
  });

  it("refuses a margin that leaves no content box, per paper", () => {
    // 400 px of margin fits neither, and 397 leaves nothing on A4 alone.
    expect(() => resolveDocumentTokens({ marginPx: 408 })).toThrow(/marginPx/);
    expect(() => resolveDocumentTokens({ pageSize: "a4", marginPx: 397 })).toThrow(/marginPx/);
    expect(() => resolveDocumentTokens({ marginPx: 397 })).not.toThrow();
  });
});

describe("comparing two resolved sets", () => {
  it("covers every field the type declares", () => {
    expect(DOCUMENT_TOKEN_KEYS).toEqual(
      expect.arrayContaining(["fontFamily", "fontStack", "accentColor", "pageSize", "marginPx", "logo"])
    );
    expect(DOCUMENT_TOKEN_KEYS).toHaveLength(6);
  });

  it("is true only when nothing about the document moved", () => {
    const base = resolveDocumentTokens();
    expect(sameDocumentTokens(base, resolveDocumentTokens())).toBe(true);
    for (const [key, value] of [
      ["fontFamily", SERIF_FONT_NAME],
      ["accentColor", "#0f766e"],
      ["pageSize", "a4"],
      ["marginPx", 56],
      ["logo", "https://example.test/mark.png"],
    ] as const) {
      expect(sameDocumentTokens(base, resolveDocumentTokens({ [key]: value })), key).toBe(false);
    }
  });
});
