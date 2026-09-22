/**
 * The PDF-path proof the QR code lacked.
 *
 * `components.test.tsx` proves the QR code renders as configurable SVG
 * markup; nothing proved a rendered PDF actually carries the code at all, or
 * that it decodes. Both engines draw the code as vector fills rather than an
 * embedded raster image (`readPdf` finds no `paintImageXObject` on either
 * page, only `constructPath` and `setFillRGBColor`), so a decode proof means
 * painting the page and reading its pixels back, on the default engine and
 * on the Chromium adapter, the way `specs/compose-complete-documents-with-
 * the-owned-components.md` asks.
 *
 * The code sits inside a real `Document`, not a bare element: the spec's own
 * scenario is "a developer renders a **document** with a QR code", and a
 * bare element proves nothing about the code surviving the document's own
 * margin and page plan.
 */

import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { renderPdf } from "@paradoc/react-pdf";
import { chromiumExecutable, closeChromium } from "@paradoc/react-pdf/chromium";
import { checkElement } from "@paradoc/react-pdf/check";
import jsQR from "jsqr";
import puppeteer, { type Browser } from "puppeteer";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Document, EmptyQRCodeUrlError, QRCode } from "../src";
import { purchaseOrderData } from "../src/examples/purchase-order-data";
import { purchaseOrderForm } from "../src/examples/purchase-order";
import { rasterizePdfPage } from "./pdf-raster";
import { readPdf } from "./pdf-reader";

/** The URL every fixture in this file encodes. */
const ENCODED_URL = "https://docs.paradoc.dev/forms/123";

/**
 * Device pixels per PDF point the decode proof rasterizes at.
 *
 * Load-bearing: the code is 29 modules across a 200 CSS pixel box, and at 1x
 * that is under 5 device pixels per module once the CSS-to-PDF-point scale is
 * folded in — too coarse for jsQR to lock onto reliably. 2x comfortably
 * clears it.
 */
const RASTER_SCALE = 2;

function documentWithCode(url: string) {
  return (
    <Document artifact={purchaseOrderForm} data={purchaseOrderData} id="qr-proof">
      <QRCode url={url} size={200} />
    </Document>
  );
}

/**
 * True when page 1 of `bytes` paints at least one filled vector path.
 *
 * Reads the operator list rather than the page's pixels, so it needs no
 * canvas and no browser: a QR code drawn as vector fills (which is what both
 * engines draw — see the module doc) has to carry `constructPath` and
 * `setFillRGBColor` somewhere on its page, whether or not anything can
 * rasterize that page on this machine. This is what proves the code is
 * *present* on the default engine independently of the decode proof below,
 * which is the one half of this file's job that needs no Chrome at all.
 */
async function hasFilledVectorInk(bytes: Uint8Array): Promise<boolean> {
  const document_ = await getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  try {
    const page = await document_.getPage(1);
    const { fnArray } = await page.getOperatorList();
    return fnArray.includes(OPS.constructPath) && fnArray.includes(OPS.setFillRGBColor);
  } finally {
    await document_.destroy();
  }
}

/** Rasterizes page 1 of `bytes` and asserts it decodes to `expected`. */
async function assertPageDecodesTo(browser: Browser, bytes: Uint8Array, expected: string): Promise<void> {
  const pages = await readPdf(bytes);
  expect(pages).toHaveLength(1);

  const raster = await rasterizePdfPage(browser, bytes, 1, RASTER_SCALE);
  const code = jsQR(raster.data, raster.width, raster.height);
  expect(code, "no QR code was found in the rasterized page at all").not.toBeNull();
  expect(code?.data).toBe(expected);
}

describe("QRCode", () => {
  it("fails by name on an empty url", () => {
    expect(() => renderToStaticMarkup(<QRCode url="" />)).toThrow(EmptyQRCodeUrlError);
  });

  it("passes the composition check with no unsupported class, unresolved path, or missing image", async () => {
    const result = await checkElement(<QRCode url={ENCODED_URL} />);
    expect(result.unsupportedClasses).toEqual([]);
    expect(result.unresolvedPaths).toEqual([]);
    // The inline `<svg>` a `QRCode` emits carries its own bytes (see
    // `preparePdfTree`'s `carriesOwnBytes`), so a render needs nothing the
    // caller does not already have: the check reports it as no image at all,
    // not as one still owed bytes.
    expect(result.missingImages).toEqual([]);
  });

  it("is present in a rendered PDF on the default engine, with no browser needed to see it", async () => {
    const { bytes } = await renderPdf(documentWithCode(ENCODED_URL));
    const pages = await readPdf(bytes);
    expect(pages).toHaveLength(1);
    expect(await hasFilledVectorInk(bytes)).toBe(true);
  });

  // Neither engine embeds the code as a raster image (both draw vector
  // fills), so proving either one *decodes* means painting its page
  // somewhere, and a headless Chrome tab is what this suite paints with. The
  // default engine's presence is already proven above with no browser; only
  // the stronger, scannable-decode proof needs one, on both engines.
  const skipDecoding = process.env.PARADOC_SKIP_CHROMIUM_TESTS === "1";
  if (skipDecoding) {
    console.log("Skipping the QR decode proof on both engines: PARADOC_SKIP_CHROMIUM_TESTS=1.");
  }

  describe.skipIf(skipDecoding)("decodes on the PDF path", () => {
    let browser: Browser;

    beforeAll(async () => {
      const executable = await chromiumExecutable();
      if (executable === undefined) {
        throw new Error(
          "The QR decode proof needs a Chrome to rasterize the page it decodes, on both " +
            "engines: neither engine embeds the code as a raster image, so pixels have to be " +
            "painted somewhere. None of the well-known install paths exists: set " +
            "PUPPETEER_EXECUTABLE_PATH to one, or set PARADOC_SKIP_CHROMIUM_TESTS=1 to opt " +
            "out of this file's decode proof deliberately."
        );
      }
      browser = await puppeteer.launch({
        executablePath: executable,
        headless: true,
        args: [
          // GitHub's Ubuntu runners restrict user namespaces, which the
          // sandbox needs; unsandboxed only in CI, never on a developer's
          // machine. Matches the parity suite's `lab.ts` and the Chromium
          // adapter's own launch.
          ...(process.env.CI ? ["--no-sandbox", "--disable-setuid-sandbox"] : []),
        ],
      });
    }, 60_000);

    afterAll(async () => {
      await browser?.close();
      // This file owns the Chromium adapter's shared browser whenever it ran
      // the adapter half, and nothing else in this package's suite does.
      await closeChromium();
    });

    it("decodes to the encoded URL on the default engine", async () => {
      const { bytes } = await renderPdf(documentWithCode(ENCODED_URL));
      await assertPageDecodesTo(browser, bytes, ENCODED_URL);
    }, 60_000);

    it("decodes to the encoded URL on the Chromium adapter", async () => {
      const { bytes } = await renderPdf(documentWithCode(ENCODED_URL), { adapter: "chromium" });
      await assertPageDecodesTo(browser, bytes, ENCODED_URL);
    }, 60_000);
  });
});
