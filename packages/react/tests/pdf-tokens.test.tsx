/**
 * Tenant branding on the PDF side.
 *
 * The tokens are declared on the document, and the PDF path has to learn them
 * from the document rather than be told them a second time: the page geometry
 * goes into the prepared input and the font files are read off disk before an
 * engine sees anything. So what is under test is that the render reads them,
 * that each one changes the bytes, and that a family with no files fails loudly
 * rather than being written as null glyphs.
 *
 * Every token is checked by rendering twice and requiring the two files to
 * differ. A byte comparison is the right assertion here precisely because it
 * cannot pass by accident: the same document with the same tokens renders the
 * same bytes, which the first test asserts, so a difference is the token.
 */

import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { Bundle } from "../src/components/bundle";
import { Document } from "../src/components/document";
import { Section } from "../src/components/section";
import { markDocumentRoot, RootTokenMismatchError } from "../src/components/tokens-context";
import { Totals } from "../src/components/totals";

import {
  brandedProposalTokens,
  proposalForm,
  ProposalDocument,
  shortProposalData,
  BRANDED_ACCENT_COLOR,
} from "../src/examples";
import { proposalLogoImage } from "../src/examples/pdf";
import { SERIF_FONT_NAME, UnregisteredFontFamilyError } from "../src/lib/font";
import { DEFAULT_DOCUMENT_TOKENS, type DocumentTokensInput } from "../src/lib/tokens";
import { renderPdf, type PdfImage } from "../src/pdf";
import { documentFontFiles } from "../src/pdf/resources";
import { documentTokensOf } from "../src/lib/document-tokens";
import { readPdf } from "./pdf-reader";

/** CSS pixels to the points a PDF page box is stated in. */
const POINTS_PER_PIXEL = 72 / 96;

let logo: PdfImage | undefined;

/** The sample's mark, read once. The branded set carries its own and needs none. */
async function sampleLogo(): Promise<PdfImage> {
  logo ??= await proposalLogoImage();
  return logo;
}

/** The proposal rendered with one token set, as bytes. */
async function render(tokens?: DocumentTokensInput): Promise<Uint8Array> {
  const { bytes } = await renderPdf(<ProposalDocument data={shortProposalData} tokens={tokens} />, {
    images: [await sampleLogo()],
  });
  return bytes;
}

function same(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}

describe("the render reads the tokens off the document", () => {
  it("finds what the document declared", () => {
    const tokens = documentTokensOf(
      <ProposalDocument data={shortProposalData} tokens={brandedProposalTokens} />
    );
    expect(tokens.fontFamily).toBe(SERIF_FONT_NAME);
    expect(tokens.pageSize).toBe("a4");
    expect(tokens.marginPx).toBe(56);
    expect(tokens.accentColor).toBe(BRANDED_ACCENT_COLOR);
    expect(tokens.logo).toMatch(/^data:image\/png;base64,/);
  });

  it("finds the defaults on a document that declares nothing", () => {
    expect(documentTokensOf(<ProposalDocument data={shortProposalData} />)).toEqual(
      DEFAULT_DOCUMENT_TOKENS
    );
  });

  it("reads them without rendering the document", () => {
    // The walk is pure: a component that would throw when rendered still
    // answers, which is what makes it safe to call during the furniture's own
    // render and twice under concurrent rendering. It is wrapped *around* the
    // document rather than being the document, so the walk has to pass through
    // it without calling it to reach the tokens at all.
    const Explodes = ({ children: _children }: { children: ReactNode }) => {
      throw new Error("rendered");
    };
    expect(
      documentTokensOf(
        <Explodes>
          <ProposalDocument data={shortProposalData} tokens={brandedProposalTokens} />
        </Explodes>
      ).pageSize
    ).toBe("a4");
  });

  it("lets a render override one token and keep the rest of the document's", () => {
    const tokens = documentTokensOf(
      <ProposalDocument data={shortProposalData} tokens={brandedProposalTokens} />,
      { pageSize: "letter" }
    );
    expect(tokens.pageSize).toBe("letter");
    expect(tokens.marginPx).toBe(56);
    expect(tokens.fontFamily).toBe(SERIF_FONT_NAME);
  });

  it("falls back to the defaults when there is no document root at all", () => {
    expect(documentTokensOf(<p>not a document</p>)).toEqual(DEFAULT_DOCUMENT_TOKENS);
  });
});

describe("the same document with the same tokens renders the same bytes", () => {
  it("is stable, which is what makes every comparison below mean something", async () => {
    expect(same(await render(), await render())).toBe(true);
    expect(same(await render(brandedProposalTokens), await render(brandedProposalTokens))).toBe(
      true
    );
  }, 60_000);
});

describe("each token changes the PDF", () => {
  it("changes it for the page size, and the page box says which paper", async () => {
    const letter = await readPdf(await render());
    const a4 = await readPdf(await render({ pageSize: "a4" }));

    expect(letter[0]!.size.width).toBeCloseTo(816 * POINTS_PER_PIXEL, 1);
    expect(letter[0]!.size.height).toBeCloseTo(1056 * POINTS_PER_PIXEL, 1);
    expect(a4[0]!.size.width).toBeCloseTo(794 * POINTS_PER_PIXEL, 1);
    expect(a4[0]!.size.height).toBeCloseTo(1123 * POINTS_PER_PIXEL, 1);
  }, 60_000);

  it("changes it for the margin", async () => {
    expect(same(await render(), await render({ marginPx: 96 }))).toBe(false);
  }, 60_000);

  it("changes it for the font family", async () => {
    expect(same(await render(), await render({ fontFamily: SERIF_FONT_NAME }))).toBe(false);
  }, 60_000);

  it("changes it for the accent colour", async () => {
    expect(same(await render(), await render({ accentColor: BRANDED_ACCENT_COLOR }))).toBe(false);
  }, 60_000);

  it("changes it for the logo, and the page still paints one", async () => {
    const branded = await render({ logo: brandedProposalTokens.logo });
    expect(same(await render(), branded)).toBe(false);
    expect((await readPdf(branded))[0]!.hasImage).toBe(true);
  }, 60_000);
});

describe("the faces the render embeds are the family the document named", () => {
  it("reads the serif family's own files, not the default family's", async () => {
    const serif = await documentFontFiles(SERIF_FONT_NAME);
    expect(serif.length).toBeGreaterThan(0);
    for (const file of serif) {
      expect(file.family).toBe(SERIF_FONT_NAME);
      expect(file.path).toContain("source-serif-4");
    }

    const inter = await documentFontFiles();
    expect(inter.map((file) => file.path)).not.toEqual(serif.map((file) => file.path));
  });

  it("refuses to render a family it carries no files for, naming it", async () => {
    await expect(render({ fontFamily: "Comic Sans MS" })).rejects.toThrow(
      UnregisteredFontFamilyError
    );
    await expect(render({ fontFamily: "Comic Sans MS" })).rejects.toThrow(/Comic Sans MS/);
    // Synchronous: the family is looked up before any file is read, so the
    // caller is told at the call rather than at an await.
    expect(() => documentFontFiles("Comic Sans MS")).toThrow(UnregisteredFontFamilyError);
  });
});

describe("a render's own tokens override the document's", () => {
  it("renders the branded document on the paper the render named", async () => {
    const { bytes } = await renderPdf(
      <ProposalDocument data={shortProposalData} tokens={brandedProposalTokens} />,
      { images: [await sampleLogo()], tokens: { pageSize: "letter" } }
    );
    const pages = await readPdf(bytes);
    expect(pages[0]!.size.width).toBeCloseTo(816 * POINTS_PER_PIXEL, 1);
  }, 60_000);

  it("brands a document that declares nothing of its own", async () => {
    const { bytes } = await renderPdf(<ProposalDocument data={shortProposalData} />, {
      images: [await sampleLogo()],
      tokens: brandedProposalTokens,
    });
    const pages = await readPdf(bytes);
    expect(pages[0]!.size.width).toBeCloseTo(794 * POINTS_PER_PIXEL, 1);
    expect(same(bytes, await render())).toBe(false);
  }, 60_000);
});

describe("the render checks the document against what it resolved", () => {
  /**
   * A composition that brands itself where the element walk cannot see it.
   *
   * This is the shape a React layer renders on every call: the renderer builds
   * the composition with an artifact and data and no `tokens` prop at all, so
   * anything the composition decides for itself is invisible from outside.
   */
  function selfBranded(hidden: DocumentTokensInput) {
    return function SelfBranded() {
      return (
        <Bundle tokens={hidden}>
          <Document artifact={proposalForm} data={shortProposalData} id="hidden">
            <Section id="a" title="A">
              <Totals rows={[{ def: "total" }]} />
            </Section>
          </Document>
        </Bundle>
      );
    };
  }

  it.each([
    ["pageSize", { pageSize: "a4" } as DocumentTokensInput],
    ["fontFamily", { fontFamily: SERIF_FONT_NAME } as DocumentTokensInput],
    ["marginPx", { marginPx: 72 } as DocumentTokensInput],
  ])("refuses a PDF whose document hid %s from the render, naming the token", async (token, hidden) => {
    // Without this the render succeeds and lies: the paper and the faces are
    // the render's, and a serif dropped this way is byte-identical to a
    // document that never asked for one.
    const Hidden = selfBranded(hidden);
    await expect(renderPdf(<Hidden />, { images: [await sampleLogo()] })).rejects.toThrow(
      RootTokenMismatchError
    );
    await expect(renderPdf(<Hidden />, { images: [await sampleLogo()] })).rejects.toThrow(
      new RegExp(token)
    );
  }, 60_000);

  it("renders a composition that forwards its tokens", async () => {
    function Forwards({ tokens }: { tokens?: DocumentTokensInput }) {
      return <ProposalDocument data={shortProposalData} tokens={tokens} />;
    }
    markDocumentRoot(Forwards);
    const { bytes } = await renderPdf(<Forwards tokens={brandedProposalTokens} />, {
      images: [await sampleLogo()],
    });
    expect((await readPdf(bytes))[0]!.size.width).toBeCloseTo(794 * POINTS_PER_PIXEL, 1);
  }, 60_000);
});
