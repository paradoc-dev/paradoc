/**
 * Shared fixture for `party.test.tsx` and `party-pdf.test.tsx`.
 *
 * `buyer` is filled once, with the three extension members beyond the
 * artifact's own person/organization schema. `witness` is filled twice: the
 * first with only a name, so the "omits a member the record does not carry"
 * behavior stays proven, and the second with all three extension members
 * too, so a multiply-filled role and the inline variant are proven printing
 * organization, address, and contact, not only a name.
 */
import type { Form } from "@paradoc/types";

export const partyFixtureForm = {
  name: "party-component",
  fields: {},
  parties: {
    buyer: { label: "Buyer", partyType: "person", min: 1, max: 1 },
    witness: { label: "Witness", partyType: "person", min: 0, max: 3 },
  },
} as unknown as Form;

export const partyFixtureData = {
  fields: {},
  parties: {
    buyer: {
      name: "Dana Whitfield",
      organization: { name: "Northgate Systems" },
      address: { line1: "1400 Rio Grande Street", locality: "Austin", region: "TX", postalCode: "78701", country: "US" },
      phone: { number: "+15125550123" },
    },
    witness: [
      { name: "First Witness" },
      {
        name: "Second Witness",
        organization: { name: "Harbor Freight Collective" },
        address: { line1: "88 Wharf Road", locality: "Oakland", region: "CA", postalCode: "94607", country: "US" },
        phone: { number: "+15105550199" },
      },
    ],
  },
};
