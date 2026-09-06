/**
 * A packet filled in a session, then sealed.
 *
 * The packet has two fillable artifacts, and both are driven here by the real
 * engine: the composed purchase order and the registry W-9. Nothing is filled
 * by hand, and no answer is invented; the two derived values the purchase order
 * needs are computed from the answers by `purchaseOrderDocumentData`, which is
 * the only thing between a session's log and a sealable draft.
 *
 * The annex has no session, because nobody fills a certificate of insurance:
 * the vendor uploads it. That is the point of the third part.
 *
 * The seal itself is `vendor-packet-seal.test.tsx`'s subject. What is under
 * test here is that a packet answered by a session seals to the same thing:
 * three parts, one merged document, one signature map, every party's slot
 * resolved.
 */

import { w9 } from "@paradoc/essentials";
import { pageTextRuns } from "@paradoc/render/pdf";
import type { Party } from "@paradoc/types";
import { beforeAll, describe, expect, it } from "vitest";

import {
  purchaseOrderAnswers,
  purchaseOrderData,
  purchaseOrderDocumentData,
  purchaseOrderSpec,
  VENDOR_PACKET_KEYS,
} from "../src/examples";
import { insuranceCertificateFixture, sealVendorPacket } from "../src/examples/pdf";
import { fillBySession, type FilledSession } from "./session-driver";

/** What a vendor would answer a W-9 with. The optional tail is skipped. */
const W9_ANSWERS = {
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
  parties: { taxpayer: { id: "taxpayer-0", name: "Dana Whitfield" } },
};

/** The W-9 draft, filled from what its session answered and ready to seal. */
function taxpayerDraft(filled: FilledSession) {
  const parsed = w9.safeParseData(filled.payload as never);
  if (!parsed.success) {
    throw new Error(`the session's W-9 answers did not parse: ${JSON.stringify(parsed.errors)}`);
  }
  return w9
    .fill(parsed.data, { rules: false })
    .addSigner("taxpayer-signer", { person: { name: "Dana Whitfield" } })
    .addSignatory("taxpayer", "taxpayer-0", { signerId: "taxpayer-signer" });
}

let order: FilledSession;
let taxpayer: FilledSession;
let packet: Awaited<ReturnType<typeof sealVendorPacket>>;
let pages: Awaited<ReturnType<typeof pageTextRuns>>;

beforeAll(async () => {
  order = fillBySession("purchase-order", purchaseOrderSpec, purchaseOrderAnswers);
  taxpayer = fillBySession("w-9", w9.toJSON(), W9_ANSWERS);

  packet = await sealVendorPacket({
    taxpayer: taxpayerDraft(taxpayer),
    insurance: await insuranceCertificateFixture(),
    purchaseOrderData: purchaseOrderDocumentData(order.payload),
  });
  pages = await pageTextRuns(packet.pdf);
}, 180_000);

/** The text of one packet page, runs joined. */
const textOf = (page: number) => pages[page - 1]!.runs.map((run) => run.text).join(" ");

describe("both fillable parts were answered by a session", () => {
  it("collected every field the purchase order's seal needs", () => {
    expect(order.order).toContain("buyerContact");
    expect(order.order).toContain("party:buyer");
    expect(order.order).toContain("party:supplier");
    // The two derived values are never asked for.
    expect(order.order).not.toContain("subtotalAmount");
  });

  it("skipped the W-9's optional tail rather than inventing answers", () => {
    expect(taxpayer.order).toContain("party:taxpayer");
    expect(taxpayer.order).toContain("taxClassification");
    expect(taxpayer.order).toContain("mailingAddress");
    expect(taxpayer.order.filter((did) => did.startsWith("skip:")).length).toBeGreaterThan(0);
    // Nothing the vendor was not asked about ended up in the log.
    expect(taxpayer.payload.fields).not.toHaveProperty("ssn");
  });

  it("left both sessions ready to render", () => {
    expect(order.payload.fields.orderNumber).toBe("PO-2026-0512");
    expect((order.payload.parties.buyer as Party & { id: string }).id).toBe("buyer-0");
    expect(taxpayer.payload.fields.ein).toBe("47-2938471");
  });

  it("derives the two computed values from the answers rather than from the log", () => {
    const rows = order.payload.fields.lineItems as Record<string, unknown>[];
    expect(rows.every((row) => row.amount === undefined)).toBe(true);

    // Against the sample rather than against a number written here: what the
    // projection must produce is the sample, and a sample that grows a row
    // should not need this test edited.
    const data = purchaseOrderDocumentData(order.payload);
    expect(data.fields.subtotalAmount).toBe(purchaseOrderData.fields.subtotalAmount);
    expect(data.fields.lineItems).toEqual(purchaseOrderData.fields.lineItems);
  });
});

describe("the packet a session filled", () => {
  it("seals as one document over all three parts", () => {
    expect(packet.parts.map((part) => part.key)).toEqual([
      VENDOR_PACKET_KEYS.purchaseOrder,
      VENDOR_PACKET_KEYS.taxpayer,
      VENDOR_PACKET_KEYS.insurance,
    ]);
    expect(packet.canonicalPdfHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(packet.warnings).toEqual([]);
  });

  it("resolves every party's signature slot on a packet page", () => {
    expect(packet.signatureMap.length).toBeGreaterThanOrEqual(3);
    const parts = new Map(packet.parts.map((part) => [part.key, part]));
    for (const slot of packet.signatureMap) {
      const part = parts.get(slot.part);
      expect(part, `slot "${slot.id}" names an unknown part`).toBeDefined();
      expect(slot.page).toBeGreaterThanOrEqual(part!.firstPage);
      expect(slot.page).toBeLessThan(part!.firstPage + part!.pageCount);
      expect(slot.width).toBeGreaterThan(0);
    }
    // The composition's own two slots, drawn by its `Signature` blocks.
    const composed = packet.signatureMap.filter(
      (slot) => slot.part === VENDOR_PACKET_KEYS.purchaseOrder
    );
    expect(composed.map((slot) => slot.slot).sort()).toEqual([
      "buyer-signature",
      "supplier-signature",
    ]);
  });

  it("prints what the session answered on the pages the seal claims", () => {
    const [composed, taxpayerPart] = packet.parts;
    expect(textOf(composed!.firstPage)).toContain(purchaseOrderData.fields.orderNumber as string);
    expect(textOf(taxpayerPart!.firstPage)).toContain("Northgate Systems, LLC");
  });
});
