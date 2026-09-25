/**
 * Sample data for `party-demo.ts`.
 *
 * The party records carry names only. The buyer's organization, address, and
 * phone are field values the artifact declares beside the `buyer` role, which
 * the demo's `Party` names by path. `witness` is filled twice, so a variant
 * can select the second one by `index`.
 */
import type { DocumentData } from "@paradoc/react";

export const partyDemoData: DocumentData = {
  fields: {
    buyerOrganization: { name: "Northgate Systems" },
    buyerAddress: {
      line1: "1400 Rio Grande Street",
      line2: "Suite 220",
      locality: "Austin",
      region: "TX",
      postalCode: "78701",
      country: "US",
    },
    buyerPhone: { number: "+15125550142", type: "work" },
  },
  parties: {
    buyer: { name: "Dana Whitfield", firstName: "Dana", lastName: "Whitfield" },
    witness: [
      { name: "Marisol Vega" },
      { name: "Priya Natarajan" },
    ],
  },
};
