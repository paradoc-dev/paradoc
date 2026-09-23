/**
 * `withoutPrintDates`, on hand-built files: no browser needed. The Chromium
 * render itself is checked across a second boundary in `pdf-chromium.test.tsx`.
 */

import { describe, expect, it } from "vitest";
import { withoutPrintDates } from "../src/pdf/adapters/chromium-dates";

const STAMP = "(D:20260923141402+00'00')";

/** A minimal PDF shaped like Skia's: the information dictionary first, named by the trailer. */
function pdf(date: string, options: { infoRef?: string; body?: string } = {}): Uint8Array {
  const source = [
    "%PDF-1.4",
    "1 0 obj",
    "<</Title (document.html)",
    "/Producer (Skia/PDF m153)",
    `/CreationDate ${date}`,
    `/ModDate ${date}>>`,
    "endobj",
    "11 0 obj",
    `<</Note (/CreationDate ${STAMP})>>`,
    "endobj",
    options.body ?? "",
    "trailer",
    `<</Size 12${options.infoRef ?? "\n/Info 1 0 R"}>>`,
    "startxref",
    "0",
    "%%EOF",
  ].join("\n");
  return new Uint8Array(Buffer.from(source, "latin1"));
}

const latin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

describe("withoutPrintDates", () => {
  it("blanks the information dictionary's dates without moving a byte", () => {
    const input = pdf(STAMP);
    const output = withoutPrintDates(input);

    expect(output).toHaveLength(input.length);
    const [info] = latin1(output).split("endobj");
    expect(info).not.toContain("CreationDate");
    expect(info).not.toContain("ModDate");
    expect(info).toContain("/Producer (Skia/PDF m153)");
    // Everything outside the two entries is the input's own bytes.
    expect(latin1(output).replaceAll(" ", "")).toBe(
      latin1(input).replace(`/CreationDate ${STAMP}`, "").replace(`/ModDate ${STAMP}`, "").replaceAll(" ", "")
    );
  });

  it("makes two files printed a second apart identical", () => {
    const earlier = withoutPrintDates(pdf("(D:20260923141402+00'00')"));
    const later = withoutPrintDates(pdf("(D:20260923141403+00'00')"));
    expect(Buffer.from(later).equals(Buffer.from(earlier))).toBe(true);
  });

  it("leaves a date outside the information dictionary alone", () => {
    const output = latin1(withoutPrintDates(pdf(STAMP)));
    expect(output).toContain(`<</Note (/CreationDate ${STAMP})>>`);
  });

  it("returns a file whose trailer names no information dictionary unchanged", () => {
    const input = pdf(STAMP, { infoRef: "" });
    expect(withoutPrintDates(input)).toBe(input);
  });

  it("returns a file with no trailer unchanged", () => {
    const input = new Uint8Array(Buffer.from(`%PDF-1.4\n1 0 obj\n<</CreationDate ${STAMP}>>\nendobj\n`, "latin1"));
    expect(withoutPrintDates(input)).toBe(input);
  });
});
