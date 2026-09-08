/**
 * The engagement letter artifact this package's prose document composes.
 *
 * Sample material, like the rest of `./examples`. Its purpose is evidence, and
 * the evidence is the opposite of the priced samples'. The proposal, the
 * purchase order and the invoice are all a masthead over a table: what
 * paginates is rows, and a row is a small keep of a predictable height. A
 * letter has no table at all. It is numbered clauses of running prose, each of
 * which is one keep tall enough that where it lands decides where the page
 * breaks, and it ends in two signing blocks that must not be split from the
 * clause above them. That is the case the components are otherwise never asked.
 *
 * It carries no `defs`. Nothing on a letter is computed: the fee basis is a
 * sentence and the retainer is a figure the parties agreed, so there is no
 * arithmetic for the expression language to do and none is invented to give it
 * some.
 *
 * The layer is the seal target. It declares a flow-placed signature slot per
 * party, and the renderer registered for it draws the marker for each slot
 * where the `Signature` block for that party sits. Nothing else describes where
 * a signature goes. `engagement-letter-seal.ts` is the wiring, which is the
 * same shape the proposal's is.
 */

import { para } from "@paradoc/core";
import type { Form } from "@paradoc/types";

/** The layer that names the composition, and the layer the seal targets. */
export const ENGAGEMENT_LETTER_REACT_LAYER = "composition";

/**
 * The composition module the React layer points at, as the layer declares it.
 *
 * Relative to the artifact file that declares it, which is this one, so it names
 * the sibling module and nothing more. The string is the key a consumer binds
 * the component under, so it is exported rather than written twice.
 */
export const ENGAGEMENT_LETTER_REACT_LAYER_PATH = "engagement-letter-document.tsx";

/**
 * The artifact's signature slots, by the party role each one binds to. A slot
 * names its role, so the seal puts each marker on the `Signature` block for that
 * role without anything mapping the two.
 */
export const ENGAGEMENT_LETTER_SIGNATURE_SLOTS = {
  firm: "firm-signature",
  client: "client-signature",
} as const satisfies Record<string, string>;

/** The engagement letter, exactly as authored. Kept beside the instance for evaluators that take a raw `Form`. */
export const engagementLetterSpec = {
  $schema: "https://schema.paradoc.dev/schema.json",
  kind: "form",
  name: "engagement-letter",
  version: "1.0.0",
  title: "Engagement Letter",
  description:
    "A letter engaging a firm to act for a client: the scope of services as numbered clauses, the fees, the term and how it ends, the governing law, and a signature from each party.",
  metadata: {
    domain: "professional-services",
  },
  parties: {
    firm: {
      label: "Firm",
      description: "The firm agreeing to act.",
      partyType: "organization",
      min: 1,
      max: 1,
      signature: { required: true, witnesses: 0, notarized: false },
    },
    client: {
      label: "Client",
      description: "The organization the firm acts for.",
      partyType: "organization",
      min: 1,
      max: 1,
      signature: { required: true, witnesses: 0, notarized: false },
    },
  },
  fields: {
    reference: {
      type: "text",
      label: "Our reference",
      description: "Identifier the firm files this engagement under.",
      maxLength: 40,
      required: true,
      visible: true,
    },
    effectiveDate: {
      type: "date",
      label: "Effective date",
      description: "Date the engagement begins.",
      required: true,
      visible: true,
    },
    matter: {
      type: "text",
      label: "Matter",
      description: "What the firm is engaged to do, in one line.",
      maxLength: 200,
      required: true,
      visible: true,
    },
    firm: {
      type: "organization",
      label: "Firm",
      description: "Legal name and identifiers of the firm.",
      required: true,
      visible: true,
    },
    firmAddress: {
      type: "address",
      label: "Firm address",
      description: "Principal business address of the firm.",
      required: true,
      visible: true,
    },
    firmContact: {
      type: "person",
      label: "Engagement partner",
      description:
        "The person who signs for the firm. `sealEngagementLetter` reads this field to bind the firm's signer, because core's Signer.person is always a Person and an organization cannot fill it.",
      required: true,
      visible: true,
    },
    client: {
      type: "organization",
      label: "Client",
      description: "Legal name and identifiers of the client.",
      required: true,
      visible: true,
    },
    clientAddress: {
      type: "address",
      label: "Client address",
      description: "Principal business address of the client.",
      required: true,
      visible: true,
    },
    clientContact: {
      type: "person",
      label: "Client signatory",
      description:
        "The person who signs for the client. `sealEngagementLetter` reads this field to bind the client's signer.",
      required: true,
      visible: true,
    },
    scopeOfServices: {
      type: "list",
      label: "Scope of services",
      description: "What the firm will do, one numbered clause per undertaking.",
      minItems: 1,
      required: true,
      visible: true,
      item: {
        type: "fieldset",
        label: "Clause",
        fields: {
          heading: {
            type: "text",
            label: "Heading",
            maxLength: 80,
            required: true,
            visible: true,
          },
          detail: {
            type: "text",
            label: "Detail",
            maxLength: 1200,
            required: true,
            visible: true,
          },
        },
      },
    },
    feeBasis: {
      type: "text",
      label: "Fees",
      description: "How the firm charges for the work, and when it invoices.",
      maxLength: 2000,
      required: true,
      visible: true,
    },
    retainer: {
      type: "money",
      label: "Retainer",
      description: "The sum held on account before work begins.",
      min: 0,
      required: true,
      visible: true,
    },
    term: {
      type: "text",
      label: "Term",
      description: "How long the engagement runs.",
      maxLength: 2000,
      required: true,
      visible: true,
    },
    termination: {
      type: "text",
      label: "Termination",
      description: "How either party ends the engagement, and what survives it.",
      maxLength: 2000,
      required: true,
      visible: true,
    },
    governingLaw: {
      type: "text",
      label: "Governing law",
      description: "The law the engagement is read under, and where disputes are heard.",
      maxLength: 1000,
      required: true,
      visible: true,
    },
  },
  defaultLayer: ENGAGEMENT_LETTER_REACT_LAYER,
  layers: {
    [ENGAGEMENT_LETTER_REACT_LAYER]: {
      kind: "file",
      mimeType: "text/tsx",
      path: ENGAGEMENT_LETTER_REACT_LAYER_PATH,
      title: "Composition",
      description:
        "The React composition this letter is. The path is a pointer: nothing reads the file, and the renderer registered for text/tsx binds the module and seals it.",
      signatures: {
        [ENGAGEMENT_LETTER_SIGNATURE_SLOTS.firm]: {
          party: { role: "firm" },
          type: "signature",
          label: "Firm signature",
          placement: "flow",
        },
        [ENGAGEMENT_LETTER_SIGNATURE_SLOTS.client]: {
          party: { role: "client" },
          type: "signature",
          label: "Client signature",
          placement: "flow",
        },
      },
    },
  },
} as const;

/** The parsed, validated engagement letter. */
export const engagementLetter = para.form(engagementLetterSpec);

/**
 * The same validated artifact as a plain `Form`. Everything that renders or
 * evaluates the letter reads this, so no consumer sees the unparsed spec.
 */
export const engagementLetterForm: Form = engagementLetter.toJSON() as Form;
