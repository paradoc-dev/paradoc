/**
 * Sample data for `party-demo.ts`.
 *
 * `buyer` is filled once, with an `organization`, an `address`, and a `phone`
 * beyond the artifact's own person/organization schema — `PartyWithContact`,
 * the shape `Party` reads its organization, address, and contact lines from.
 * `witness` is filled twice, so a variant can select the second one by
 * `index`.
 */
import type { DocumentData, PartyWithContact } from "@paradoc/react";

interface PartyDemoData extends DocumentData {
  parties: {
    buyer: PartyWithContact;
    witness: PartyWithContact[];
  };
}

export const partyDemoData: PartyDemoData = {
  fields: {},
  parties: {
    buyer: {
      name: "Dana Whitfield",
      organization: { name: "Northgate Systems" },
      address: {
        line1: "1400 Rio Grande Street",
        line2: "Suite 220",
        locality: "Austin",
        region: "TX",
        postalCode: "78701",
        country: "US",
      },
      phone: { number: "+15125550142", type: "work" },
    },
    witness: [
      { name: "Marisol Vega" },
      { name: "Priya Natarajan" },
    ],
  },
};
