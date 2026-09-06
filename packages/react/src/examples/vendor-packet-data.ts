/**
 * Sample data for the vendor packet.
 *
 * **Sample material, not a stable API**, for the reason `./examples` gives.
 *
 * A packet is three documents and its sample is three things, one per part: the
 * purchase order's own data, the taxpayer's values for the W-9, and the annex
 * bytes. The three are gathered here so the block installs a packet a consumer
 * can render without inventing any of them.
 *
 * The W-9 itself is not here, and that is deliberate: `@paradoc/react` does not
 * depend on `@paradoc/essentials` and should not, because a packet declaration
 * names its parts and where a part comes from is the application's business.
 * So this carries the taxpayer's values and nothing else. A consumer holds them
 * against the artifact:
 *
 * ```ts
 * import { w9 } from "@paradoc/essentials";
 *
 * const parsed = w9.safeParseData(vendorPacketTaxpayerData);
 * const draft = w9
 *   .fill(parsed.data, { rules: false })
 *   .addSigner("taxpayer-signer", { person: { name: "Dana Whitfield" } })
 *   .addSignatory("taxpayer", "taxpayer-0", { signerId: "taxpayer-signer" });
 *
 * const pdf = await draft.render({ layer: "pdf", resolver: w9.resolver });
 * ```
 *
 * `w9.resolver` is passed explicitly because a builder call returns a runtime
 * without the bundled one; the package README records that.
 */

import { purchaseOrderData, type PurchaseOrderData } from "./purchase-order-data";
import { vendorPacketAnnexBytes } from "./vendor-packet-annex";

/**
 * The taxpayer's values for the packet's W-9.
 *
 * Untyped against the artifact on purpose: typing it would mean importing the
 * artifact, and this module does not. The shape is the payload `safeParseData`
 * takes, and the values are the supplier the purchase order names, so the two
 * parts of the packet describe one company.
 */
export const vendorPacketTaxpayerData = {
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
} as const;

/** The person who signs the W-9 for the taxpayer party. */
export const VENDOR_PACKET_TAXPAYER_SIGNER = {
  signerId: "taxpayer-signer",
  partyId: "taxpayer-0",
  person: { name: "Dana Whitfield" },
} as const;

/** The whole packet's sample, one entry per part. */
export interface VendorPacketData {
  /** The purchase order's data, as its own block ships it. */
  purchaseOrder: PurchaseOrderData;
  /** The taxpayer's values for the W-9. */
  taxpayer: typeof vendorPacketTaxpayerData;
  /** The certificate of insurance, as bytes the packet carries. */
  insurance: Uint8Array;
}

/** The vendor packet's sample. */
export const vendorPacketData: VendorPacketData = {
  purchaseOrder: purchaseOrderData,
  taxpayer: vendorPacketTaxpayerData,
  insurance: vendorPacketAnnexBytes,
};

export { vendorPacketAnnexBytes };
