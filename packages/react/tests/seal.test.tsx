/**
 * The composed document, sealed through the core seal flow.
 *
 * The criterion the specification sets is a signature map with a location for
 * every party, so these assertions read the map core returned and check the
 * boxes land on a real page of the document the seal produced. Nothing here
 * reaches inside the seal: `@paradoc/core` runs it, and this package supplies
 * only the renderer its React layer is registered under. There is no auxiliary
 * layer and no converter; the composition is the seal target.
 */

import { containsEncoding } from "@paradoc/render/pdf";
import type { SigningField } from "@paradoc/types";
import { beforeAll, describe, expect, it } from "vitest";
import {
  ProposalDocument,
  overflowProposalData,
  proposalForm,
  shortProposalData,
  PROPOSAL_REACT_LAYER,
  PROPOSAL_SIGNATURE_SLOTS,
} from "../../components/src/examples";
import { renderPdf, type PdfImage } from "../src/pdf";
import {
  fillProposalForSeal,
  proposalLogoImage,
  proposalRenderers,
  sealProposal,
} from "../../components/src/examples/pdf";
import { SIGNATURE_RULE } from "../../components/src/components/signature";
import { readPdf, type ReadPage } from "./pdf-reader";

/** CSS pixels at 96 dpi to the PDF's points at 72 dpi. */
const PX_TO_PT = 72 / 96;

let logo: PdfImage;
let sealed: Awaited<ReturnType<typeof sealProposal>>;
let pages: ReadPage[];

beforeAll(async () => {
  logo = await proposalLogoImage();
  sealed = await sealProposal({ data: overflowProposalData, images: [logo] });
  pages = await readPdf(sealed.canonicalPdfBytes!);
}, 120_000);

describe("the seal flow places both parties", () => {
  it("returns a signature map with one field per party", () => {
    expect(sealed.signatureMap).toHaveLength(2);
    expect(sealed.signatureMap!.map((field) => field.id)).toEqual(
      Object.values(PROPOSAL_SIGNATURE_SLOTS)
    );
    expect(sealed.signatureMap!.map((field) => field.signerId)).toEqual([
      "provider-signer",
      "customer-signer",
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

  it("places both fields on the acceptance page, side by side", () => {
    // The acceptance section is the last thing in the tree, and the two
    // signature blocks sit in one row, so a map that resolved from the real
    // document has them on the same page at the same height.
    const [provider, customer] = sealed.signatureMap!;
    expect(provider!.page).toBe(pages.length);
    expect(customer!.page).toBe(provider!.page);
    expect(customer!.y).toBeCloseTo(provider!.y, 1);
    expect(customer!.x).toBeGreaterThan(provider!.x);
  });

  it("resolves the boxes the README records", () => {
    // The README quotes these numbers, so they check
    // themselves here rather than being a transcription of one run. The
    // tolerance is a point: the engine's own rounding, not room for a drift.
    const [provider, customer] = sealed.signatureMap!;
    const box = (field: SigningField) => ({
      page: field.page,
      x: Math.round(field.x),
      y: Math.round(field.y),
      width: field.width,
      height: field.height,
    });
    expect(box(provider!)).toEqual({ page: 4, x: 36, y: 290, width: 77, height: 26 });
    expect(box(customer!)).toEqual({ page: 4, x: 321, y: 290, width: 77, height: 26 });
    expect(Math.abs(provider!.x - 36)).toBeLessThanOrEqual(1);
    expect(Math.abs(customer!.x - 321)).toBeLessThanOrEqual(1);
  });

  it("hashes a canonical PDF with the document's page geometry", () => {
    expect(sealed.canonicalPdfHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(pages.length).toBe(4);
    for (const page of pages) {
      expect(page.size.width).toBeCloseTo(816 * PX_TO_PT, 0);
      expect(page.size.height).toBeCloseTo(1056 * PX_TO_PT, 0);
    }
  });

  it("repeats exactly: the same data seals to the same hash and the same map", async () => {
    const again = await sealProposal({ data: overflowProposalData, images: [logo] });
    expect(again.canonicalPdfHash).toBe(sealed.canonicalPdfHash);
    expect(again.signatureMap).toEqual(sealed.signatureMap);
  }, 120_000);

  it("seals the short set onto its one page, at boxes of its own", async () => {
    // Pinned the way the overflow set's are: the short document is one page, so
    // both blocks sit on page 1 and the row is lower down it.
    const one = await sealProposal({ data: shortProposalData, images: [logo] });
    expect(one.signatureMap).toHaveLength(2);
    const box = (field: SigningField) => ({
      page: field.page,
      x: Math.round(field.x),
      y: Math.round(field.y),
      width: field.width,
      height: field.height,
    });
    const [provider, customer] = one.signatureMap!;
    expect(box(provider!)).toEqual({ page: 1, x: 36, y: 700, width: 77, height: 26 });
    expect(box(customer!)).toEqual({ page: 1, x: 321, y: 700, width: 77, height: 26 });
    expect(customer!.y).toBeCloseTo(provider!.y, 1);
  }, 120_000);
});

describe("the sealed document is the document", () => {
  it("carries the same visible text the plain render does", async () => {
    // The clean seal pass receives core's bare placeholder, which is what the
    // signature block draws on its own, so sealing adds nothing to the page.
    const plain = await readPdf(
      (await renderPdf(<ProposalDocument data={overflowProposalData} />, { images: [logo] })).bytes
    );
    expect(pages.length).toBe(plain.length);
    expect(pages.map((page) => page.text)).toEqual(plain.map((page) => page.text));
  }, 120_000);

  it("draws the signing rule core's flow placement measures", () => {
    // Core sizes a flow field from the underscore run beside its marker, so the
    // rule has to be that run. A border would leave the field unmeasurable.
    expect(SIGNATURE_RULE).toBe("________________");
    expect(pages[3]!.text).toContain(SIGNATURE_RULE);
  });

  it("leaves no marker in the canonical document", () => {
    // The marker exists only on the pass core locates against. A canonical PDF
    // carrying one would be a document with invisible text in it.
    for (const page of pages) expect(containsEncoding(page.text)).toBe(false);
  });
});

describe("the composition is the only description of the document", () => {
  it("seals against the layer that names the composition, with no second layer", () => {
    // The whole point of the ticket: the artifact declares one layer, the seal
    // targets it, and the slots ride on it.
    const layers = proposalForm.layers ?? {};
    expect(Object.keys(layers)).toEqual([PROPOSAL_REACT_LAYER]);
    expect(proposalForm.defaultLayer).toBe(PROPOSAL_REACT_LAYER);
    expect(Object.keys(layers[PROPOSAL_REACT_LAYER]?.signatures ?? {})).toEqual(
      Object.values(PROPOSAL_SIGNATURE_SLOTS)
    );
  });

  it("renders the composition to PDF through the layer core selects", async () => {
    // The same registry the seal uses, rendering with no seal in sight, is the
    // plain document. The seal adds a marker pass and nothing else.
    const bytes = await fillProposalForSeal(shortProposalData).render<Uint8Array>({
      renderers: proposalRenderers({ images: [logo] }),
    });
    const plain = await renderPdf(<ProposalDocument data={shortProposalData} />, { images: [logo] });
    expect(bytes).toEqual(plain.bytes);
  }, 120_000);
});
