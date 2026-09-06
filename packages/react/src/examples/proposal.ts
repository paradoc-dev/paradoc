/**
 * The proposal form artifact this package's reference document composes.
 *
 * Everything the document shows is declared here: the organization and customer,
 * the line-item list, the currency and tax inputs behind the computed totals, and
 * the two signing parties. The React components read this artifact and never carry
 * their own copy of a label, a format, or a total.
 *
 * The one layer it declares describes no layout. `prepareSeal` and `seal` will
 * only place signature slots that a layer declares, and flow placement needs a
 * text layer core can render markers into, so the artifact carries the smallest
 * layer that satisfies that: two slot declarations and one line per slot whose
 * whole content is the signature placeholder core produces. The React tree stays
 * the only description of the document, which is the specification's central
 * invariant; `src/examples/seal.tsx` reads the placeholders out of this layer and puts
 * them in the tree's signature blocks.
 *
 * One limitation shapes the design. The expression language indexes lists and
 * reads their length, but it has no aggregate over a list, so a subtotal cannot be
 * expressed as a def. `subtotalAmount` is therefore a field the caller
 * materializes with `computeLineAmounts`, and the artifact computes tax and total
 * from it. See the package README.
 */

import { para } from "@paradoc/core";
import type { Form } from "@paradoc/types";

/** The layer the seal flow targets. The document itself is the React tree. */
export const PROPOSAL_SIGNING_LAYER = "signing";

/**
 * The artifact's signature slots, by the party role each one binds to. The seal
 * adapter maps a slot's rendered placeholder onto the `Signature` block for the
 * same role, so this map is the one place the two are tied together.
 */
export const PROPOSAL_SIGNATURE_SLOTS = {
  provider: "provider-signature",
  customer: "customer-signature",
} as const satisfies Record<string, string>;

/** The proposal form, exactly as authored. Kept beside the instance for evaluators that take a raw `Form`. */
export const proposalSpec = {
  $schema: "https://schema.paradoc.dev/schema.json",
  kind: "form",
  name: "services-proposal",
  version: "1.0.0",
  title: "Services Proposal",
  description:
    "A priced proposal from a service provider to a customer, with line items, computed totals, and signatures from both parties.",
  metadata: {
    domain: "commerce",
  },
  parties: {
    provider: {
      label: "Provider",
      description: "The organization proposing the work and issuing the pricing.",
      partyType: "organization",
      min: 1,
      max: 1,
      signature: { required: true, witnesses: 0, notarized: false },
    },
    customer: {
      label: "Customer",
      description: "The person or organization accepting the proposal.",
      partyType: "any",
      min: 1,
      max: 1,
      signature: { required: true, witnesses: 0, notarized: false },
    },
  },
  fields: {
    proposalNumber: {
      type: "text",
      label: "Proposal number",
      description: "Identifier the provider gives this proposal.",
      maxLength: 40,
      required: true,
      visible: true,
    },
    issuedOn: {
      type: "date",
      label: "Issued",
      description: "Date the provider issued the proposal.",
      required: true,
      visible: true,
    },
    validUntil: {
      type: "date",
      label: "Valid until",
      description: "Last date the pricing holds.",
      required: false,
      visible: true,
    },
    provider: {
      type: "organization",
      label: "Provider",
      description: "Legal name and identifiers of the proposing organization.",
      required: true,
      visible: true,
    },
    providerAddress: {
      type: "address",
      label: "Provider address",
      description: "Principal business address of the provider.",
      required: true,
      visible: true,
    },
    providerPhone: {
      type: "phone",
      label: "Provider phone",
      description: "Contact number for questions about the proposal.",
      required: false,
      visible: true,
    },
    providerContact: {
      type: "person",
      label: "Provider contact",
      description:
        "The person who signs for the provider. Not printed: the document names the party, and who signed it is what the seal records. `sealProposal` reads this field to bind the provider's signer, because core's Signer.person is always a Person and an organization cannot fill it.",
      required: true,
      visible: false,
    },
    customer: {
      type: "organization",
      label: "Customer",
      description: "The organization the proposal is addressed to.",
      required: true,
      visible: true,
    },
    customerContact: {
      type: "person",
      label: "Customer contact",
      description:
        "The person at the customer who receives the proposal, and the person who signs for it. `sealProposal` reads this field to bind the customer's signer.",
      required: true,
      visible: true,
    },
    customerAddress: {
      type: "address",
      label: "Customer address",
      description: "Billing address of the customer.",
      required: true,
      visible: true,
    },
    summary: {
      type: "text",
      label: "Summary",
      description: "One paragraph describing the engagement.",
      maxLength: 2000,
      required: false,
      visible: true,
    },
    currency: {
      type: "text",
      label: "Currency",
      description: "ISO 4217 currency code every amount on the proposal is quoted in.",
      pattern: "^[A-Z]{3}$",
      required: true,
      visible: true,
    },
    lineItems: {
      type: "list",
      label: "Line items",
      description: "The priced work, one row per deliverable.",
      minItems: 1,
      required: true,
      visible: true,
      item: {
        type: "fieldset",
        label: "Line item",
        fields: {
          description: {
            type: "text",
            label: "Description",
            maxLength: 300,
            required: true,
            visible: true,
          },
          quantity: {
            type: "number",
            label: "Qty",
            min: 0,
            required: true,
            visible: true,
          },
          unit: {
            type: "text",
            label: "Unit",
            maxLength: 20,
            required: true,
            visible: true,
          },
          unitPrice: {
            type: "money",
            label: "Unit price",
            min: 0,
            required: true,
            visible: true,
          },
          amount: {
            type: "money",
            label: "Amount",
            min: 0,
            required: true,
            visible: true,
          },
        },
      },
    },
    subtotalAmount: {
      type: "number",
      label: "Subtotal amount",
      description:
        "Sum of the line-item amounts. Materialized by the caller because the expression language has no list aggregate. Not shown as a field: the document surfaces it through the `subtotal` def, so the reader sees one serialized money value rather than a bare number.",
      min: 0,
      required: true,
      visible: false,
    },
    taxRatePercent: {
      type: "percentage",
      label: "Tax rate",
      description: "Sales-tax rate applied to the subtotal, as a percentage.",
      min: 0,
      max: 100,
      required: true,
      visible: true,
    },
    terms: {
      type: "text",
      label: "Terms",
      description: "Payment and acceptance terms.",
      maxLength: 2000,
      required: false,
      visible: true,
    },
  },
  defs: {
    subtotal: {
      type: "money",
      label: "Subtotal",
      description: "The line-item total before tax.",
      value: {
        amount: "fields.subtotalAmount",
        currency: "fields.currency",
      },
    },
    tax: {
      type: "money",
      label: "Tax",
      description: "Sales tax on the subtotal at the quoted rate.",
      value: {
        amount: "fields.subtotalAmount * fields.taxRatePercent / 100",
        currency: "fields.currency",
      },
    },
    total: {
      type: "money",
      label: "Total",
      description: "Amount due if the customer accepts the proposal.",
      value: {
        amount: "fields.subtotalAmount + fields.subtotalAmount * fields.taxRatePercent / 100",
        currency: "fields.currency",
      },
    },
  },
  layers: {
    [PROPOSAL_SIGNING_LAYER]: {
      kind: "inline",
      mimeType: "text/plain",
      title: "Signing slots",
      description:
        "Slot declarations for the seal flow. One line per slot: the slot id, a tab, and the placeholder core renders for it. No layout, no document text.",
      text: [
        `${PROPOSAL_SIGNATURE_SLOTS.provider}\t{{#with parties.provider}}{{signature "${PROPOSAL_SIGNATURE_SLOTS.provider}"}}{{/with}}`,
        `${PROPOSAL_SIGNATURE_SLOTS.customer}\t{{#with parties.customer}}{{signature "${PROPOSAL_SIGNATURE_SLOTS.customer}"}}{{/with}}`,
      ].join("\n"),
      signatures: {
        [PROPOSAL_SIGNATURE_SLOTS.provider]: {
          party: { role: "provider" },
          type: "signature",
          label: "Provider signature",
          placement: "flow",
        },
        [PROPOSAL_SIGNATURE_SLOTS.customer]: {
          party: { role: "customer" },
          type: "signature",
          label: "Customer signature",
          placement: "flow",
        },
      },
    },
  },
} as const;

/** The parsed, validated proposal form. */
export const proposal = para.form(proposalSpec);

/**
 * The same validated artifact as a plain `Form`. Everything that renders or
 * evaluates the proposal reads this, so no consumer sees the unparsed spec.
 */
export const proposalForm: Form = proposal.toJSON() as Form;
