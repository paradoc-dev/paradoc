/**
 * The takumi adapter: the default PDF path, behind the seam.
 *
 * `takumi-pdf` lays the tree out and writes vector PDF from WebAssembly — no
 * browser process, selectable text, subset fonts. `@takumi-rs/helpers` resolves
 * the React tree into a plain node tree that still carries `className` and the
 * `data-*` attributes the components wrote, and `preparePdfTree` translates it.
 *
 * The geometry is the engine's page margin, not padding on the tree: a padded
 * root would indent the first page only, because the engine reapplies its own
 * margin to every page. The browser's preflight is restated in
 * `PDF_RESET_STYLESHEET`, without which the same tree lays out a tenth taller
 * on paper.
 *
 * Anything the engine cannot express fails here with every offender named. The
 * engine drops a class it cannot express and says nothing, so every class is
 * checked against the verified vocabulary before the render rather than after.
 */

import { fromJsx } from "@takumi-rs/helpers/jsx";
import { measure, render } from "takumi-pdf";

import {
  UnsupportedPdfContentError,
  type PdfAdapter,
  type PdfAdapterOptions,
  type PdfRenderResult,
  type PreparedPdfInput,
} from "../adapter";
import { PDF_RESET_STYLESHEET } from "../reset";
import { imageFormat, pdfFonts } from "../resources";
import { preparePdfTree, recordOnce } from "../tree";
import { measureFurnitureBands, translateFurniture } from "./takumi-furniture";

/** The engine the parity numbers are measured on, and the default `renderPdf` reaches for. */
export const takumiAdapter: PdfAdapter = {
  name: "takumi",

  // Left to right only, and measured rather than assumed. The engine reverses a
  // flex container's main axis for `dir="rtl"`, so a row's columns do come out
  // in the right order, but it has no `direction` property: an inline run in a
  // block box starts on the left edge whatever `dir` says, and `text-start`
  // renders byte-identical to `text-left`. So a right-to-left document would be
  // a document with its columns reversed and every line still left-aligned,
  // which is worse than a refusal. See "Right to left" in the README.
  directions: ["ltr"],

  // All three: the engine repeats a header and a footer band on every page of
  // its own accord, and the stamp rides the header band as a whole-sheet layer.
  // See `takumi-furniture.ts`.
  furniture: ["header", "footer", "stamp"],

  async render(input: PreparedPdfInput, options: PdfAdapterOptions): Promise<PdfRenderResult> {
    const { node, stylesheets: treeStylesheets } = await fromJsx(input.element);

    const prepared = preparePdfTree(node, {
      plan: input.plan,
      imageSources: input.images.map((image) => image.src),
      // The resolved text is checked against the resolved family here, where
      // both exist: a document written in a script the family cannot set
      // reaches this engine as null glyphs and no error.
      lang: options.lang,
    });

    // The bands the engine repeats on every page. They are translated with the
    // tree rather than after it so that one unsupported class fails one render,
    // wherever on the page it is.
    const furniture = await translateFurniture(input.furniture, {
      geometry: input.geometry,
      imageSources: input.images.map((image) => image.src),
      lang: options.lang,
    });

    const offendingClasses = [...prepared.unsupportedClasses];
    for (const name of furniture.unsupportedClasses) recordOnce(offendingClasses, name);
    const badImages = [...prepared.missingImages, ...furniture.missingImages];
    for (const image of input.images) {
      if (imageFormat(image.data) === undefined) recordOnce(badImages, image.src);
    }

    if (offendingClasses.length > 0 || badImages.length > 0) {
      throw new UnsupportedPdfContentError(offendingClasses, badImages);
    }

    // The faces are the prepared input's, loaded rather than resolved again:
    // the Chromium adapter is handed the same list as `@font-face` rules, and
    // two adapters that looked their own files up could embed different ones.
    const fonts = await pdfFonts(input.fonts);

    const size = { width: input.geometry.widthPx, height: input.geometry.heightPx };
    const fontFamilies = [...new Set(input.fonts.map((font) => font.family)), "sans-serif"];
    const stylesheets = [PDF_RESET_STYLESHEET, ...treeStylesheets, ...furniture.stylesheets];

    // Measured with the same faces, images and stylesheets the page is
    // rendered with, because a band measured against anything else is a band
    // measured wrong: a running head carrying a mark whose bytes the measure
    // never saw lays out short and then overprints the first line of the page.
    const images = input.images.map((image) => ({ src: image.src, data: image.data }));
    const bands = await measureFurnitureBands(furniture, input.geometry, async (band) => {
      const measured = await measure(band, { size, fonts, fontFamilies, images, stylesheets, lang: options.lang });
      return measured.height;
    });

    const bytes = await render(prepared.node, {
      size,
      margin: input.geometry.marginPx,
      ...bands,
      fonts,
      // The generic comes from the family's own registration: a serif that fell
      // back to a sans would be a different document.
      fontFamilies,
      images,
      stylesheets,
      lang: options.lang,
    });

    return {
      bytes,
      unknownBreaks: prepared.unknownBreaks,
      unknownRepeats: prepared.unknownRepeats,
    };
  },
};
