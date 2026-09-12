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
 *   .fill(parsed.data)
 *   .addSigner("taxpayer-signer", { person: { name: "Dana Whitfield" } })
 *   .addSignatory("taxpayer", "taxpayer-0", { signerId: "taxpayer-signer" });
 *
 * const pdf = await draft.render({ layer: "pdf" });
 * ```
 *
 * No resolver is passed: `@paradoc/essentials` binds each artifact's bundled
 * resolver when it constructs the form, and every instance derived from it —
 * including the one every mutator above returns — carries it.
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
 *
 * The party carries `firstName`/`lastName` alongside `name`: the format
 * package infers a party's identity (person vs. organization) from which of
 * those disambiguating keys are present on the record itself, and a bare
 * `name` alone answers neither, so rendering the taxpayer's identity — filled
 * PDF included — would otherwise fail as ambiguous.
 */
export const vendorPacketTaxpayerData = {
  parties: {
    taxpayer: { id: "taxpayer-0", name: "Dana Whitfield", firstName: "Dana", lastName: "Whitfield" },
  },
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
