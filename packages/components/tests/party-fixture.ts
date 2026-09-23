/**
 * Shared fixture for `party.test.tsx` and `party-pdf.test.tsx`.
 *
 * The party records carry only their names. What the blocks print about each
 * party beyond that lives in declared fields beside the parties: the buyer's
 * organization, address, phone, and email as top-level fields, and each
 * witness's details as one item of the `witnessContacts` list, so a
 * multiply-filled role binds each index to its own item. The first witness's
 * item is empty, so the "leaves off a blank line" behavior stays proven.
 */
import type { Form } from "@paradoc/types";

export const partyFixtureForm = {
  name: "party-component",
  fields: {
    buyerOrganization: { type: "organization", label: "Buyer organization" },
    buyerAddress: { type: "address", label: "Buyer address" },
    buyerPhone: { type: "phone", label: "Buyer phone" },
    buyerEmail: { type: "email", label: "Buyer email" },
    witnessContacts: {
      type: "list",
      label: "Witness contacts",
      item: {
        type: "fieldset",
        label: "Witness contact",
        fields: {
          organization: { type: "organization", label: "Organization" },
          address: { type: "address", label: "Address" },
          phone: { type: "phone", label: "Phone" },
        },
      },
    },
  },
  parties: {
    buyer: { label: "Buyer", partyType: "person", min: 1, max: 1 },
    witness: { label: "Witness", partyType: "person", min: 0, max: 3 },
  },
} as unknown as Form;

export const partyFixtureData = {
  fields: {
    buyerOrganization: { name: "Northgate Systems" },
    buyerAddress: { line1: "1400 Rio Grande Street", locality: "Austin", region: "TX", postalCode: "78701", country: "US" },
    buyerPhone: { number: "+15125550123" },
    buyerEmail: "dana@northgate.example",
    witnessContacts: [
      {},
      {
        organization: { name: "Harbor Freight Collective" },
        address: { line1: "88 Wharf Road", locality: "Oakland", region: "CA", postalCode: "94607", country: "US" },
        phone: { number: "+15105550199" },
      },
    ],
  },
  parties: {
    buyer: { name: "Dana Whitfield" },
    witness: [{ name: "First Witness" }, { name: "Second Witness" }],
  },
};

/** The buyer block's paths. */
export const buyerPaths = {
  organization: "buyerOrganization",
  address: "buyerAddress",
  contact: ["buyerPhone", "buyerEmail"],
} as const;

/** The paths for the witness at `index`, into its own `witnessContacts` item. */
export function witnessPaths(index: number) {
  return {
    organization: `witnessContacts.${index}.organization`,
    address: `witnessContacts.${index}.address`,
    contact: `witnessContacts.${index}.phone`,
  };
}
