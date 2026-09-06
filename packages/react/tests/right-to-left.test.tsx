/**
 * The Arabic letter: its direction, its faces, and the two refusals.
 *
 * Three claims are under test here, and each of them is a claim about a loss
 * that is invisible in the output on its own.
 *
 * 1. **The direction reaches both sides from one declaration.** The letter's
 *    `dir` and `lang` are root-only document tokens, so the root writes them
 *    onto the document element and the render reads the same resolution off the
 *    same element, without either being told a second time.
 * 2. **The faces the script needs are the faces the PDF embeds.** The Arabic
 *    family's Arabic subset has to be in the file list, or every Arabic
 *    codepoint is a null glyph on paper while the preview looks perfect.
 * 3. **Both ways of not being able to draw it fail by name.** The typeface that
 *    carries no Arabic fails naming the script, and the engine that cannot lay
 *    text out right to left fails naming itself.
 *
 * Whether the Chromium page is the preview's page pixel for pixel is not asked
 * here. That is a browser measurement against a running lab, and it is
 * `tests/parity/`.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  arabicLetterData,
  arabicLetterForm,
  ArabicLetterDocument,
  arabicLetterTokens,
  ProposalDocument,
  shortProposalData,
} from "../src/examples";
import { documentTokensOf } from "../src/lib/document-tokens";
import {
  resolveDocumentTokens,
  DEFAULT_DOCUMENT_TOKENS,
  InvalidDocumentTokenError,
} from "../src/lib/tokens";
import { ARABIC_FONT_NAME, DOCUMENT_FONT_NAME, documentFontFamily } from "../src/lib/font";
import {
  assertScriptCovered,
  assertTextScriptsCovered,
  scriptOf,
  scriptsIn,
  UnsupportedScriptError,
} from "../src/lib/script";
import { Document } from "../src/components/document";
import { Field, LTR_ISOLATE_CLASS } from "../src/components/field";
import { preparePdfTree } from "../src/pdf/tree";
import { unsupportedClasses } from "../src/pdf/tailwind";
import { assertDirectionSupported, UnsupportedDirectionError } from "../src/pdf/adapter";
import { takumiAdapter } from "../src/pdf/adapters/takumi";
import { renderPdf } from "../src/pdf";
import { documentFontFiles } from "../src/pdf/resources";

const letter = <ArabicLetterDocument data={arabicLetterData} tokens={arabicLetterTokens} />;

describe("the letter declares its script once, on its root", () => {
  it("is read off the element the way the paper is", () => {
    const tokens = documentTokensOf(letter);
    expect(tokens.fontFamily).toBe(ARABIC_FONT_NAME);
    expect(tokens.dir).toBe("rtl");
    expect(tokens.lang).toBe("ar");
  });

  it("writes dir and lang onto the document element the preview draws", () => {
    const markup = renderToStaticMarkup(letter);
    expect(markup).toContain('dir="rtl"');
    expect(markup).toContain('lang="ar"');
    // On the document element itself, not on some wrapper: everything below it
    // inherits the direction, and the element is what both outputs render.
    expect(markup).toMatch(/<article[^>]*data-document-id="arabic-letter"[^>]*dir="rtl"/u);
  });

  it("is a root-only token, so a render may layer over it and a nested document may not", () => {
    // The override is the last layer, exactly as it is for the paper: a render
    // that changes only the direction keeps the typeface the letter chose.
    expect(documentTokensOf(letter, { dir: "ltr" })).toMatchObject({
      dir: "ltr",
      lang: "ar",
      fontFamily: ARABIC_FONT_NAME,
    });
  });

  it("leaves a document that declares nothing left to right in English", () => {
    expect(DEFAULT_DOCUMENT_TOKENS.dir).toBe("ltr");
    expect(DEFAULT_DOCUMENT_TOKENS.lang).toBe("en");
    expect(documentTokensOf(<div />)).toMatchObject({ dir: "ltr", lang: "en" });
  });

  it("refuses a direction and a language no renderer could act on", () => {
    expect(() => resolveDocumentTokens({ dir: "sideways" as never })).toThrow(
      InvalidDocumentTokenError
    );
    expect(() => resolveDocumentTokens({ lang: "not a tag" })).toThrow(
      InvalidDocumentTokenError
    );
  });
});

describe("the script decides which faces have to be embedded", () => {
  it("maximizes the language tag to its script rather than carrying a table", () => {
    expect(scriptOf("ar")).toBe("Arab");
    expect(scriptOf("ar-SA")).toBe("Arab");
    expect(scriptOf("en")).toBe("Latn");
    // An unparsable tag adds no requirement rather than inventing a failure.
    expect(scriptOf("not a tag")).toBe("Latn");
  });

  it("embeds the Arabic family's own Arabic subset", async () => {
    const files = await documentFontFiles(ARABIC_FONT_NAME);
    expect(files.every((file) => file.family === ARABIC_FONT_NAME)).toBe(true);
    expect(files.map((file) => file.path)).toContainEqual(
      expect.stringContaining("noto-sans-arabic-arabic-wght-normal.woff2")
    );
    // Every subset the stylesheet loads, not only the Arabic one: a face the
    // preview has and the PDF lacks renders as null glyphs with no error.
    expect(files).toHaveLength(documentFontFamily(ARABIC_FONT_NAME).subsets.length);
    const arabic = files.find((file) => file.path.includes("-arabic-"))!;
    // The face has to declare the Arabic block, or the engine never reaches it.
    expect(arabic.unicodeRange).toContain("U+0600-06FF");
  });

  it("covers Arabic and Latin, so the letter's digits are the same family", () => {
    expect(documentFontFamily(ARABIC_FONT_NAME).scripts).toEqual(
      expect.arrayContaining(["Arab", "Latn"])
    );
    expect(() => {
      assertScriptCovered(ARABIC_FONT_NAME, "ar");
    }).not.toThrow();
    expect(() => {
      assertScriptCovered(ARABIC_FONT_NAME, "en");
    }).not.toThrow();
  });
});

describe("a typeface that carries no Arabic fails naming the script", () => {
  it("names the script, the family, and the family that would work", () => {
    let thrown: unknown;
    try {
      assertScriptCovered(DOCUMENT_FONT_NAME, "ar");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(UnsupportedScriptError);
    const error = thrown as UnsupportedScriptError;
    expect(error.script).toBe("Arab");
    expect(error.family).toBe(DOCUMENT_FONT_NAME);
    expect(error.families).toContain(ARABIC_FONT_NAME);
    expect(error.message).toContain("Arab");
    expect(error.message).toContain(DOCUMENT_FONT_NAME);
    expect(error.message).toContain(ARABIC_FONT_NAME);
  });

  it("refuses the render before an engine is even chosen", async () => {
    // The override names the family, so nothing about the letter changes except
    // the one thing that makes it unrenderable. It fails whichever adapter is
    // asked, because the loss is the typeface rather than the engine.
    await expect(
      renderPdf(letter, { adapter: "chromium", tokens: { fontFamily: DOCUMENT_FONT_NAME } })
    ).rejects.toThrow(UnsupportedScriptError);
  });

  it("refuses it in the preview too, because resolving the tokens is the check", () => {
    // The browser would substitute a face and show a plausible page, which is
    // exactly why the check is not left to the PDF path. Both sides resolve the
    // same set from the same declaration, so both make the same refusal.
    expect(() =>
      resolveDocumentTokens({ ...arabicLetterTokens, fontFamily: DOCUMENT_FONT_NAME })
    ).toThrow(UnsupportedScriptError);
    expect(() =>
      renderToStaticMarkup(
        <ArabicLetterDocument
          data={arabicLetterData}
          tokens={{ ...arabicLetterTokens, fontFamily: DOCUMENT_FONT_NAME }}
        />
      )
    ).toThrow(UnsupportedScriptError);
  });

  it("leaves a Latin document alone", () => {
    expect(() => {
      assertScriptCovered(DOCUMENT_FONT_NAME, "en");
    }).not.toThrow();
  });
});

describe("a document that declares nothing and is Arabic anyway fails too", () => {
  // The tag is a declaration; this is the text. A composition that names no
  // language is set in Inter by default, and Inter has no Arabic: the browser
  // substitutes a face and the engine writes a null glyph for every letter, and
  // the two are a different document with nothing between them. Neither the
  // tokens nor the data would have said so, which is why the check is over the
  // text the document is about to print.
  const undeclared = (
    <Document artifact={arabicLetterForm} data={arabicLetterData} id="undeclared">
      <Field path="body" label={false} />
    </Document>
  );

  it("names the script and the family that would carry it", () => {
    let thrown: unknown;
    try {
      renderToStaticMarkup(undeclared);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(UnsupportedScriptError);
    const error = thrown as UnsupportedScriptError;
    expect(error.script).toBe("Arab");
    expect(error.family).toBe(DOCUMENT_FONT_NAME);
    expect(error.families).toContain(ARABIC_FONT_NAME);
  });

  it("fails on the PDF side too, from the resolved text rather than the data", async () => {
    // The walk sees what an engine would: the text after every component has
    // run. A composition that built its Arabic from something the data does not
    // carry would still be caught here.
    await expect(renderPdf(undeclared, { adapter: "takumi" })).rejects.toThrow(
      UnsupportedScriptError
    );
  });

  it("says the same thing from the tree walk on its own", () => {
    expect(() =>
      assertTextScriptsCovered(DOCUMENT_FONT_NAME, "en", ["مرحبا"])
    ).toThrow(UnsupportedScriptError);
    expect(() =>
      assertTextScriptsCovered(ARABIC_FONT_NAME, "ar", ["مرحبا", "SAR 1,850.00"])
    ).not.toThrow();
  });

  it("leaves a Latin document alone, digits and punctuation included", () => {
    expect(() =>
      assertTextScriptsCovered(DOCUMENT_FONT_NAME, "en", [
        "Northgate Systems, LLC",
        "$1,850.00 — 4 items (8.25%)",
      ])
    ).not.toThrow();
    expect(scriptsIn("$1,850.00 (8.25%)").size).toBe(0);
    expect([...scriptsIn("مرحبا Hello")]).toEqual(expect.arrayContaining(["Arab", "Latn"]));
  });

  it("ships the sample correct as it stands, with no tokens passed", () => {
    // The letter defaults its own token set, so a reader who copies the sample
    // gets the document rather than a page of null glyphs.
    const markup = renderToStaticMarkup(<ArabicLetterDocument data={arabicLetterData} />);
    expect(markup).toContain('dir="rtl"');
    expect(markup).toContain('lang="ar"');
  });
});

describe("an engine that cannot lay a document out right to left fails naming itself", () => {
  it("is what takumi declares, because that is what it was measured to do", () => {
    expect(takumiAdapter.directions).toEqual(["ltr"]);
  });

  it("refuses the letter, naming the adapter and the script", async () => {
    let thrown: unknown;
    try {
      await renderPdf(letter, { adapter: "takumi" });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(UnsupportedDirectionError);
    const error = thrown as UnsupportedDirectionError;
    expect(error.adapter).toBe("takumi");
    expect(error.direction).toBe("rtl");
    expect(error.script).toBe("Arab");
    expect(error.lang).toBe("ar");
    expect(error.message).toContain("takumi");
    expect(error.message).toContain("Arab");
  });

  it("still renders the same letter left to right, which is what makes it the direction", async () => {
    // Same tree, same typeface, same faces; only the direction the render
    // resolves changes. A refusal that survived this would be a refusal about
    // the script or the family instead.
    await expect(
      renderPdf(letter, { adapter: "takumi", tokens: { dir: "ltr" } })
    ).resolves.toMatchObject({ unknownBreaks: [] });
  });

  it("names the adapter for any engine that declares the direction away", () => {
    // The check is the seam's, not one adapter's: an engine added later gets
    // the same refusal from the same function.
    expect(() =>
      assertDirectionSupported({ name: "takumi", directions: [] }, "ltr", "Latn", "en")
    ).toThrow(UnsupportedDirectionError);
    expect(() =>
      assertDirectionSupported({ name: "chromium", directions: ["ltr", "rtl"] }, "rtl", "Arab", "ar")
    ).not.toThrow();
  });
});

describe("a value with no direction of its own is isolated", () => {
  it("wraps the letter's phone in a left-to-right isolate", () => {
    const markup = renderToStaticMarkup(letter);
    // The class for the browser and the inline style for a renderer reading no
    // stylesheet of ours, on the same span, saying the same thing.
    expect(markup).toMatch(
      /<span[^>]*class="paradoc-ltr-isolate[^"]*"[^>]*style="direction:ltr;unicode-bidi:isolate"/u
    );
  });

  it("leaves the Latin references alone, which is what keeps their bytes", () => {
    // The proposal carries a phone too. A left-to-right document resolves it
    // left to right already, so isolating it there would change the tree, and
    // the file, of every document that never had the problem.
    const markup = renderToStaticMarkup(
      <ProposalDocument data={shortProposalData} />
    );
    expect(markup).not.toContain("paradoc-ltr-isolate");
    expect(markup).not.toContain("unicode-bidi");
  });

  it("carries no dir or lang attribute on a Latin document at all", () => {
    // The defaults are the initial values both outputs already apply, so
    // writing them would change the node tree and the bytes of every document
    // that never asked about its script.
    const markup = renderToStaticMarkup(<ProposalDocument data={shortProposalData} />);
    expect(markup).not.toContain("dir=");
    expect(markup).not.toContain("lang=");
  });

  it("is admitted by the verified class vocabulary", () => {
    // The isolate is a rule of this package's own stylesheet rather than a
    // Tailwind utility, so the allow-list has to know it by name or the PDF
    // path would refuse every right-to-left document that used it.
    expect(unsupportedClasses(`${LTR_ISOLATE_CLASS} whitespace-pre-line`)).toEqual([]);
  });
});

describe("the tree walk is the last thing to see the resolved text", () => {
  it("fails there too, even for a tree no component produced", () => {
    // Straight to the walk, with a node tree rather than an element: the check
    // belongs to the translation, so a caller that assembled a tree by hand
    // gets it as well.
    expect(() =>
      preparePdfTree(
        { type: "text", text: "مرحبا" },
        { fontFamily: DOCUMENT_FONT_NAME, lang: "en" }
      )
    ).toThrow(UnsupportedScriptError);
  });

  it("makes no claim about the text when no family is named", () => {
    // Translating a fragment is not rendering a document, and a walk with no
    // family has nothing to check the text against.
    expect(() => preparePdfTree({ type: "text", text: "مرحبا" })).not.toThrow();
  });
});

describe("the letter is an artifact like any other", () => {
  it("declares its composition as a React layer and no signature slot", () => {
    const layer = arabicLetterForm.layers?.composition;
    expect(layer).toMatchObject({ kind: "file", mimeType: "text/tsx" });
    expect(layer && "signatures" in layer ? layer.signatures : undefined).toBeUndefined();
  });

  it("carries enough rows to run past one page", () => {
    // The plan has a break to place and a header to repeat only if the schedule
    // overflows. A shrunk data set would make the parity run vacuous.
    expect((arabicLetterData.fields.items as unknown[]).length).toBeGreaterThanOrEqual(20);
  });
});
