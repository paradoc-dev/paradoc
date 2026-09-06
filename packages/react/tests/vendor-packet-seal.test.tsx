/**
 * The vendor packet, assembled and sealed as one thing.
 *
 * The criterion the specification sets is that the packet of a composition, the
 * registry W-9 and an annex shows all three and seals with one signature map
 * resolving every party's slot. These assertions read what
 * `sealBundle` returned and check it against the packet it produced: the pages
 * are the parts' pages in order, every box lands on a packet page that carries
 * the part it came from, one signer holds one index however many slots they
 * fill, and the W-9's filled values survived into the merged document.
 *
 * The W-9 comes from `@paradoc/essentials`, a development dependency here. The
 * package does not depend on the registry, and neither does the packet: the
 * bundle names the part by slug and the caller hands in the filled draft.
 */

import { w9 } from "@paradoc/essentials";
import { BundleSealError } from "@paradoc/core";
import { pageTextRuns } from "@paradoc/render/pdf";
import { beforeAll, describe, expect, it } from "vitest";
import {
  purchaseOrderData,
  VENDOR_PACKET_KEYS,
  vendorPacketBundle,
} from "../src/examples";
import {
  fillPurchaseOrderForSeal,
  insuranceCertificateFixture,
  insuranceCertificatePdf,
  sealVendorPacket,
  vendorPacketRenderers,
} from "../src/examples/pdf";
import { inspectPdf } from "@paradoc/render/pdf";
import { sealBundle } from "@paradoc/core";

/** The W-9's own sample vector, with a signatory bound to the taxpayer party. */
function taxpayerDraft() {
  const parsed = w9.safeParseData({
    parties: { taxpayer: { id: "taxpayer-0", name: "Dana Whitfield" } },
    fields: {
      taxClassification: "partnership",
      businessName: "Northgate Systems, LLC",
      ein: "47-2938471",
      mailingAddress: {
        line1: "1400 Rio Grande Street",
        line2: "Suite 220",
        locality: "Austin",
        region: "TX",
        postalCode: "78701",
        country: "US",
      },
    },
  } as never);
  if (!parsed.success) throw new Error("the W-9 vector should parse");
  return w9
    .fill(parsed.data, { rules: false })
    .addSigner("taxpayer-signer", { person: { name: "Dana Whitfield" } })
    .addSignatory("taxpayer", "taxpayer-0", { signerId: "taxpayer-signer" });
}

let annex: Uint8Array;
let packet: Awaited<ReturnType<typeof sealVendorPacket>>;
let pages: Awaited<ReturnType<typeof pageTextRuns>>;

beforeAll(async () => {
  // The checked-in fixture, which is what a block installed into a browser
  // project gets. `insuranceCertificatePdf` redraws the same document and is
  // exercised separately.
  annex = await insuranceCertificateFixture();
  packet = await sealVendorPacket({
    taxpayer: taxpayerDraft(),
    insurance: annex,
    resolver: w9.resolver,
  });
  pages = await pageTextRuns(packet.pdf);
}, 180_000);

/** The text of one packet page, runs joined. */
const textOf = (page: number) => pages[page - 1]!.runs.map((run) => run.text).join(" ");

describe("the packet is one document", () => {
  it("carries every part, in the order the bundle declares", () => {
    expect(packet.parts.map((part) => part.key)).toEqual(
      vendorPacketBundle.contents.map((content) => content.key)
    );
    expect(packet.parts.map((part) => part.kind)).toEqual(["sealed", "sealed", "annex"]);
  });

  it("gives every part a page range, contiguous from page one", () => {
    let expected = 1;
    for (const part of packet.parts) {
      expect(part.firstPage).toBe(expected);
      expect(part.pageCount).toBeGreaterThan(0);
      expect(part.attached).toBe(false);
      expected += part.pageCount;
    }
    expect(pages).toHaveLength(expected - 1);
  });

  it("hashes the merged document and the packet", () => {
    expect(packet.canonicalPdfHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(packet.packetHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(packet.packetHash).not.toBe(packet.canonicalPdfHash);
  });

  it("puts each part's own content on the pages it claims", async () => {
    const [order, taxpayer, insurance] = packet.parts;

    expect(textOf(order!.firstPage)).toContain(purchaseOrderData.fields.orderNumber as string);
    // The W-9's filled values are page content, not form state: the part was
    // flattened before it was merged.
    expect(textOf(taxpayer!.firstPage)).toContain("Northgate Systems, LLC");
    expect(textOf(insurance!.firstPage)).toContain("COI-2026-44812");
  });
});

describe("the checked-in annex", () => {
  it("is the document its generator draws", async () => {
    const drawn = await insuranceCertificatePdf();

    // Not byte equality: the engine's output is stable but the fixture is
    // regenerated deliberately, not on every run. What must hold is that the
    // file is the same document, one readable page of the same text.
    expect((await inspectPdf(annex)).pageCount).toBe((await inspectPdf(drawn)).pageCount);
    const text = (await pageTextRuns(annex)).flatMap((page) => page.runs.map((run) => run.text)).join(" ");
    expect(text).toContain("COI-2026-44812");
  }, 180_000);

  it("is what the packet uses when the caller supplies no annex", async () => {
    const sealed = await sealVendorPacket({ taxpayer: taxpayerDraft(), resolver: w9.resolver });
    const carried = sealed.parts.find((part) => part.key === VENDOR_PACKET_KEYS.insurance)!;
    expect(carried.attached).toBe(false);
    expect(carried.pageCount).toBe((await inspectPdf(annex)).pageCount);
  }, 180_000);
});

describe("the packet has one signature map", () => {
  it("resolves every slot of every part", () => {
    expect(packet.signatureMap.map((field) => field.id)).toEqual([
      `${VENDOR_PACKET_KEYS.purchaseOrder}/buyer-signature`,
      `${VENDOR_PACKET_KEYS.purchaseOrder}/supplier-signature`,
      `${VENDOR_PACKET_KEYS.taxpayer}/sb1`,
      `${VENDOR_PACKET_KEYS.taxpayer}/sb2`,
    ]);
    expect(packet.signatureMap.map((field) => field.part)).toEqual([
      VENDOR_PACKET_KEYS.purchaseOrder,
      VENDOR_PACKET_KEYS.purchaseOrder,
      VENDOR_PACKET_KEYS.taxpayer,
      VENDOR_PACKET_KEYS.taxpayer,
    ]);
  });

  it("numbers every box on a packet page, offset by the parts before it", () => {
    const first = new Map(packet.parts.map((part) => [part.key, part.firstPage]));
    for (const field of packet.signatureMap) {
      expect(field.page).toBe(field.partPage + first.get(field.part)! - 1);
      expect(field.page).toBeGreaterThanOrEqual(1);
      expect(field.page).toBeLessThanOrEqual(pages.length);
      expect(field.width).toBeGreaterThan(0);
      expect(field.height).toBeGreaterThan(0);
    }
  });

  it("holds three signers, one per person, scoped to the part that bound them", () => {
    // Three people sign this packet: the buyer and the supplier sign the
    // purchase order, and the taxpayer signs and dates the W-9. Nobody signs
    // twice, and the taxpayer's two slots are one signer.
    expect(packet.signers).toEqual([
      {
        id: `${VENDOR_PACKET_KEYS.purchaseOrder}/buyer-signer`,
        index: 0,
        parts: [`${VENDOR_PACKET_KEYS.purchaseOrder}/buyer-signer`],
      },
      {
        id: `${VENDOR_PACKET_KEYS.purchaseOrder}/supplier-signer`,
        index: 1,
        parts: [`${VENDOR_PACKET_KEYS.purchaseOrder}/supplier-signer`],
      },
      {
        id: `${VENDOR_PACKET_KEYS.taxpayer}/taxpayer-signer`,
        index: 2,
        parts: [`${VENDOR_PACKET_KEYS.taxpayer}/taxpayer-signer`],
      },
    ]);
    expect(packet.signatureMap.map((field) => field.signerIndex)).toEqual([0, 1, 2, 2]);
    expect(packet.signatureMap.map((field) => field.partSignerId)).toEqual([
      "buyer-signer",
      "supplier-signer",
      "taxpayer-signer",
      "taxpayer-signer",
    ]);
  });

  it("makes the supplier and the taxpayer one person only when told they are", async () => {
    // Northgate signs the purchase order and certifies the W-9. That is one
    // company and, here, one person, but nothing in either artifact says so.
    const sealed = await sealVendorPacket({
      taxpayer: taxpayerDraft(),
      insurance: annex,
      resolver: w9.resolver,
      signers: {
        [`${VENDOR_PACKET_KEYS.purchaseOrder}/supplier-signer`]: "northgate-principal",
        [`${VENDOR_PACKET_KEYS.taxpayer}/taxpayer-signer`]: "northgate-principal",
      },
    });

    expect(sealed.signers.map((signer) => signer.id)).toEqual([
      `${VENDOR_PACKET_KEYS.purchaseOrder}/buyer-signer`,
      "northgate-principal",
    ]);
    expect(sealed.signers[1]!.parts).toEqual([
      `${VENDOR_PACKET_KEYS.purchaseOrder}/supplier-signer`,
      `${VENDOR_PACKET_KEYS.taxpayer}/taxpayer-signer`,
    ]);
    expect(new Set(sealed.signatureMap.map((field) => field.signerIndex))).toEqual(new Set([0, 1]));
  }, 180_000);

  it("keeps each box inside the page it was placed on", () => {
    for (const field of packet.signatureMap) {
      const page = pages[field.page - 1]!;
      const width = page.mediaBox[2] - page.mediaBox[0];
      const height = page.mediaBox[3] - page.mediaBox[1];
      expect(field.x).toBeGreaterThanOrEqual(0);
      expect(field.y).toBeGreaterThanOrEqual(0);
      expect(field.x + field.width).toBeLessThanOrEqual(width + 1);
      expect(field.y + field.height).toBeLessThanOrEqual(height + 1);
    }
  });
});

describe("the packet refuses what it cannot assemble", () => {
  it("names a content key with no entry", async () => {
    const failure = await sealBundle(vendorPacketBundle, { contents: {} }).catch(
      (error: unknown) => error
    );
    expect(failure).toBeInstanceOf(BundleSealError);
    expect((failure as BundleSealError).problems).toEqual([
      `bundle content "${VENDOR_PACKET_KEYS.purchaseOrder}" has no entry`,
      `bundle content "${VENDOR_PACKET_KEYS.taxpayer}" has no entry`,
      `bundle content "${VENDOR_PACKET_KEYS.insurance}" has no entry`,
    ]);
  });

  it("names an entry the bundle does not declare", async () => {
    const failure = await sealBundle(vendorPacketBundle, {
      contents: {
        "not-a-part": { kind: "bytes", content: annex, mimeType: "application/pdf" },
      },
    }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(BundleSealError);
    expect((failure as Error).message).toContain('entry "not-a-part" is not a content of this bundle');
  });
});

describe("an annex nobody can paint is still in the packet", () => {
  it("travels beside the merged document, with its own digest in the packet record", async () => {
    // A real TIFF header, because the packet checks that bytes are what the
    // entry declares before it tries to paint them.
    const scan = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const sealed = await sealBundle(vendorPacketBundle, {
      resolver: w9.resolver,
      renderers: vendorPacketRenderers(),
      contents: {
        [VENDOR_PACKET_KEYS.purchaseOrder]: fillPurchaseOrderForSeal(),
        [VENDOR_PACKET_KEYS.taxpayer]: taxpayerDraft(),
        [VENDOR_PACKET_KEYS.insurance]: {
          kind: "bytes",
          content: scan,
          mimeType: "image/tiff",
          filename: "certificate.tiff",
        },
      },
    });

    const attachment = sealed.parts.find((part) => part.key === VENDOR_PACKET_KEYS.insurance)!;
    expect(attachment.attached).toBe(true);
    expect(attachment.pageCount).toBe(0);
    expect(attachment.firstPage).toBe(0);
    expect(attachment.filename).toBe("certificate.tiff");
    expect(attachment.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    // The merged document has only the two paintable parts, so the packet's
    // record is the only thing accounting for the attachment. The signer signs
    // the merged document, whose hash is canonicalPdfHash.
    expect(sealed.packetHash).not.toBe(sealed.canonicalPdfHash);
    expect(sealed.warnings).toContain(
      `${VENDOR_PACKET_KEYS.insurance}: carried as an attachment because it is image/tiff, which the packet cannot paint`
    );
    expect(sealed.signatureMap).toHaveLength(4);
  }, 180_000);
});
