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
import { render } from "takumi-pdf";

import {
  UnsupportedPdfContentError,
  type PdfAdapter,
  type PdfAdapterOptions,
  type PdfRenderResult,
  type PreparedPdfInput,
} from "../adapter";
import { tokenFontFamily } from "../../lib/tokens";
import { PDF_RESET_STYLESHEET } from "../reset";
import { imageFormat, pdfFonts } from "../resources";
import { preparePdfTree, recordOnce } from "../tree";

/** The engine the parity numbers are measured on, and the default `renderPdf` reaches for. */
export const takumiAdapter: PdfAdapter = {
  name: "takumi",

  async render(input: PreparedPdfInput, options: PdfAdapterOptions): Promise<PdfRenderResult> {
    const { node, stylesheets } = await fromJsx(input.element);

    const prepared = preparePdfTree(node, {
      plan: input.plan,
      imageSources: input.images.map((image) => image.src),
    });

    const badImages = [...prepared.missingImages];
    for (const image of input.images) {
      if (imageFormat(image.data) === undefined) recordOnce(badImages, image.src);
    }

    if (prepared.unsupportedClasses.length > 0 || badImages.length > 0) {
      throw new UnsupportedPdfContentError(prepared.unsupportedClasses, badImages);
    }

    // The faces are the prepared input's, loaded rather than resolved again:
    // the Chromium adapter is handed the same list as `@font-face` rules, and
    // two adapters that looked their own files up could embed different ones.
    const fonts = await pdfFonts(input.fonts);

    const bytes = await render(prepared.node, {
      size: { width: input.geometry.widthPx, height: input.geometry.heightPx },
      margin: input.geometry.marginPx,
      fonts,
      // The generic comes from the family's own registration: a serif that fell
      // back to a sans would be a different document.
      fontFamilies: [input.tokens.fontFamily, tokenFontFamily(input.tokens).fallback],
      images: input.images.map((image) => ({ src: image.src, data: image.data })),
      stylesheets: [PDF_RESET_STYLESHEET, ...stylesheets],
      lang: options.lang,
    });

    return {
      bytes,
      unknownBreaks: prepared.unknownBreaks,
      unknownRepeats: prepared.unknownRepeats,
    };
  },
};
