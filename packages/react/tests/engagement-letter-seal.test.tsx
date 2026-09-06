/**
 * The engagement letter, sealed through the core seal flow.
 *
 * The proposal's seal suite proves the flow on a document whose two signing
 * blocks close a priced table. This proves it on the other kind of document:
 * the blocks close ten clauses of running prose, so where the last page starts
 * is decided by where a paragraph broke rather than by a row pitch, and the
 * markers still have to be found there. Nothing here reaches inside the seal —
 * `@paradoc/core` runs it, and this package supplies only the renderer its
 * React layer is registered under.
 */

import type { SigningField } from "@paradoc/types";
import { beforeAll, describe, expect, it } from "vitest";

import { engagementLetterData, ENGAGEMENT_LETTER_SIGNATURE_SLOTS } from "../src/examples";
import { sealEngagementLetter } from "../src/examples/pdf";
import { readPdf, type ReadPage } from "./pdf-reader";

/** CSS pixels at 96 dpi to the PDF's points at 72 dpi. */
const PX_TO_PT = 72 / 96;

let sealed: Awaited<ReturnType<typeof sealEngagementLetter>>;
let pages: ReadPage[];

beforeAll(async () => {
  sealed = await sealEngagementLetter({ data: engagementLetterData });
  pages = await readPdf(sealed.canonicalPdfBytes!);
}, 180_000);

describe("the seal flow places both parties", () => {
  it("returns a signature map with one field per party", () => {
    expect(sealed.signatureMap).toHaveLength(2);
    expect(sealed.signatureMap!.map((field) => field.id)).toEqual(
      Object.values(ENGAGEMENT_LETTER_SIGNATURE_SLOTS)
    );
    expect(sealed.signatureMap!.map((field) => field.signerId)).toEqual([
      "firm-signer",
      "client-signer",
    ]);
  });

  it("gives every field a box on a page the document has", () => {
    for (const field of sealed.signatureMap!) {
      expect(field.page).toBeGreaterThanOrEqual(1);
      expect(field.page).toBeLessThanOrEqual(pages.length);
      expect(field.width).toBeGreaterThan(0);
      expect(field.height).toBeGreaterThan(0);

      const page = pages[field.page - 1]!;
      expect(field.x).toBeGreaterThanOrEqual(0);
      expect(field.y).toBeGreaterThanOrEqual(0);
      expect(field.x + field.width).toBeLessThanOrEqual(page.size.width);
      expect(field.y + field.height).toBeLessThanOrEqual(page.size.height);
    }
  });

  it("places both fields on the last page, side by side", () => {
    // The two blocks sit in one row at the end of the tree, so a map resolved
    // from the real document has them at the same height on the same page.
    const [firm, client] = sealed.signatureMap! as [SigningField, SigningField];
    expect(firm.page).toBe(pages.length);
    expect(client.page).toBe(firm.page);
    expect(client.y).toBeCloseTo(firm.y, 1);
    expect(client.x).toBeGreaterThan(firm.x);
  });

  it("runs to more than one page, at the document's own geometry", () => {
    expect(sealed.canonicalPdfHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      expect(page.size.width).toBeCloseTo(816 * PX_TO_PT, 0);
      expect(page.size.height).toBeCloseTo(1056 * PX_TO_PT, 0);
    }
  });

  it("carries the letter's prose into the sealed bytes", () => {
    const text = pages.map((page) => page.text).join(" ");
    expect(text).toContain("Ashgrove Rowan");
    expect(text).toContain("Renegotiation of the two largest");
    expect(pages.at(-1)?.text).toContain("Signature (required)");
  });

  it("repeats exactly: the same data seals to the same hash and the same map", async () => {
    const again = await sealEngagementLetter({ data: engagementLetterData });
    expect(again.canonicalPdfHash).toBe(sealed.canonicalPdfHash);
    expect(again.signatureMap).toEqual(sealed.signatureMap);
  }, 180_000);
});
