/**
 * A minimal form artifact for the `/components/party` docs page, declaring a
 * single-filled `buyer` role, the fields its block prints beside the name,
 * and a `witness` role a document may fill more than once, so the page's demo and variants can show both an `index` and an
 * `undeclared role`/`index past the filled parties` failure without pulling
 * in a full priced document.
 *
 * Built and validated through `p.form`, the same path `proposal.ts` and every
 * other sample artifact in this package takes, rather than a cast past the
 * real `Form` type.
 */
import { p } from "@paradoc/core";
import type { Form } from "@paradoc/types";

const partyDemoSpec = {
  $schema: "https://schema.paradoc.dev/2026-09-22.json",
  kind: "form",
  name: "party-demo",
  version: "1.0.0",
  title: "Party Demo",
  description: "A minimal artifact declaring parties for the Party component's reference page.",
  fields: {
    buyerOrganization: {
      type: "organization",
      label: "Buyer organization",
      description: "The organization the buyer acts for.",
      required: false,
      visible: true,
    },
    buyerAddress: {
      type: "address",
      label: "Buyer address",
      description: "Where the buyer receives notices.",
      required: true,
      visible: true,
    },
    buyerPhone: {
      type: "phone",
      label: "Buyer phone",
      description: "The buyer's daytime phone.",
      required: false,
      visible: true,
    },
  },
  parties: {
    buyer: {
      label: "Buyer",
      description: "The person or organization placing the order.",
      partyType: "any",
      min: 1,
      max: 1,
    },
    witness: {
      label: "Witness",
      description: "A witness to the agreement. A document may name more than one.",
      partyType: "person",
      min: 0,
      max: 2,
    },
  },
} as const;

/** The parsed, validated party-demo form. */
export const partyDemo = p.form(partyDemoSpec);

/** The same validated artifact as a plain `Form`. */
export const partyDemoForm: Form = partyDemo.toJSON() as Form;
