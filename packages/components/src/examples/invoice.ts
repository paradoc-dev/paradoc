/**
 * The invoice form artifact this package's billing document composes.
 *
 * Sample material, like the rest of `./examples`. It is the third priced
 * document here, and it is a different question from the other two. The
 * proposal is an offer and the purchase order is an instruction, so both are
 * signed; an invoice is a demand for money already owed, so nothing signs it.
 * The artifact therefore declares its parties and gives neither a signature,
 * and its React layer carries no signature slot at all. What it proves is that
 * the same components compose a document the seal never touches.
 *
 * Everything the document shows is declared here: the issuer and the customer,
 * the numbering and the dates, the line-item list, the currency and tax inputs
 * behind the computed totals, and the payment terms. The React components read
 * this artifact and never carry their own copy of a label, a format, or a
 * total.
 *
 * The one limitation the other priced samples record applies here too. The
 * expression language indexes lists and reads their length, but it has no
 * aggregate over a list, so a subtotal cannot be expressed as a def.
 * `subtotalAmount` is a field the caller materializes with `computeLineAmounts`,
 * and the artifact computes tax and total from it. See the package README.
 *
 * Like the purchase order, this composition does not wrap itself in a `Bundle`:
 * it renders bare so a caller who puts it inside a packet supplies the bundle.
 */

import { p } from "@paradoc/core";
import type { Form } from "@paradoc/types";

import type { DocumentTokensInput } from "@paradoc/react";

/** The layer that names the composition. */
export const INVOICE_REACT_LAYER = "composition";

/**
 * The composition module the React layer points at, as the layer declares it.
 *
 * Relative to the artifact file that declares it, which is this one, so it names
 * the sibling module and nothing more. The string is the key a consumer binds
 * the component under, so it is exported rather than written twice.
 */
export const INVOICE_REACT_LAYER_PATH = "invoice-document.tsx";

/**
 * The issuer's mark, as base 64 PNG.
 *
 * Drawn here rather than shipped as a file, exactly as `src/examples/tokens.ts`
 * draws the branded proposal's: `logo` accepts bytes as well as a string, and a
 * sample that only ever passed a string would leave that half unexercised. The
 * token resolves bytes to a `data:` URI, which is the one image source neither
 * the browser nor the engine has to fetch — so the invoice needs no image
 * wiring on either side, and a consumer who installs the block gets a document
 * that draws its own mark.
 */
const INVOICE_LOGO_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAArklEQVR42u3YURKAIAgEUG/QTfvs" +
  "+nWDQthdIHXGX3xTDgJj/H0d13m/7ZKoNKwXRoeiYBQoCwdBsnEhpArnQqpxU8gsnBlZGogOCkey" +
  "LjYkLjs1hOMrkqsEqHqZ5F8vdJa6CtnAZYBf8A2UA5FpxnI3UxP1FC7jqaMCo8XC9O9VlltunKJg" +
  "tZ5ZqklP7Uk8Z9E7u8h7XGKClT5dkOFQqaf1hGudAWabEXCbIbpyPWS4915d7BCAAAAAAElFTkSu" +
  "QmCC";

/** Those bytes, decoded once. `atob` rather than `Buffer`: this entry is isomorphic. */
export const invoiceLogo: Uint8Array = Uint8Array.from(atob(INVOICE_LOGO_BASE64), (glyph) =>
  glyph.charCodeAt(0)
);

/** The accent the invoice is drawn in, matching its mark. */
export const INVOICE_ACCENT_COLOR = "#0f766e";

/**
 * The issuer's branding: a mark and an accent, and nothing else.
 *
 * The token set sits beside the artifact for the reason the Arabic letter's
 * does — a sample that was unbranded until a caller passed the right tokens
 * would be a sample nobody could copy — but neither key here is root-only, so
 * the composition hands this to its own `Document` and a caller who layers
 * another set over it changes only what that set names. Paper, margin and
 * typeface stay the package's defaults, which is what keeps the invoice
 * measurable against every other US Letter sample here.
 */
export const invoiceTokens: DocumentTokensInput = {
  accentColor: INVOICE_ACCENT_COLOR,
  logo: invoiceLogo,
};

/** The invoice form, exactly as authored. Kept beside the instance for evaluators that take a raw `Form`. */
export const invoiceSpec = {
  $schema: "https://schema.paradoc.dev/schema.json",
  kind: "form",
  name: "invoice",
  version: "1.0.0",
  title: "Invoice",
  description:
    "A billing document from an issuer to a customer, with line items, computed totals, and payment terms. Nothing signs it.",
  metadata: {
    domain: "commerce",
  },
  parties: {
    issuer: {
      label: "Issuer",
      description: "The organization billing for the work.",
      partyType: "organization",
      min: 1,
      max: 1,
      signature: { required: false, witnesses: 0, notarized: false },
    },
    customer: {
      label: "Bill to",
      description: "The organization the invoice is addressed to.",
      partyType: "organization",
      min: 1,
      max: 1,
      signature: { required: false, witnesses: 0, notarized: false },
    },
  },
  fields: {
    invoiceNumber: {
      type: "text",
      label: "Invoice number",
      description: "Identifier the issuer files this invoice under.",
      maxLength: 40,
      required: true,
      visible: true,
    },
    issuedOn: {
      type: "date",
      label: "Issued",
      description: "Date the issuer raised the invoice.",
      required: true,
      visible: true,
    },
    dueOn: {
      type: "date",
      label: "Due",
      description: "Date payment is due.",
      required: true,
      visible: true,
    },
    issuer: {
      type: "organization",
      label: "Issuer",
      description: "Legal name and identifiers of the billing organization.",
      required: true,
      visible: true,
    },
    issuerAddress: {
      type: "address",
      label: "Issuer address",
      description: "Principal business address of the issuer.",
      required: true,
      visible: true,
    },
    issuerEmail: {
      type: "email",
      label: "Billing email",
      description: "Where the customer writes about this invoice.",
      required: true,
      visible: true,
    },
    customer: {
      type: "organization",
      label: "Bill to",
      description: "The organization the invoice is addressed to.",
      required: true,
      visible: true,
    },
    customerAddress: {
      type: "address",
      label: "Bill to address",
      description: "Billing address of the customer.",
      required: true,
      visible: true,
    },
    customerContact: {
      type: "person",
      label: "Accounts contact",
      description: "The person in the customer's accounts team the invoice is addressed to.",
      required: true,
      visible: true,
    },
    purchaseOrderNumber: {
      type: "text",
      label: "Your order",
      description: "The customer's own order number, quoted so the invoice can be matched to it.",
      maxLength: 40,
      required: false,
      visible: true,
    },
    currency: {
      type: "text",
      label: "Currency",
      description: "ISO 4217 currency code every amount on the invoice is quoted in.",
      pattern: "^[A-Z]{3}$",
      required: true,
      visible: true,
    },
    lineItems: {
      type: "list",
      label: "Line items",
      description: "The billed goods and services, one row per item.",
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
            description:
              "The row multiplied out. Derived rather than answered, like `subtotalAmount` and for the same reason: a filler supplies the quantity and the unit price, and `computeLineAmounts` does the arithmetic.",
            min: 0,
            required: false,
            visible: false,
          },
        },
      },
    },
    subtotalAmount: {
      type: "number",
      label: "Subtotal amount",
      description:
        "Sum of the line-item amounts. Materialized by the caller because the expression language has no list aggregate. Derived rather than answered, so it is invisible and not required: no session asks for it and nothing demands it of a filler.",
      min: 0,
      required: false,
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
    paymentTerms: {
      type: "text",
      label: "Payment terms",
      description: "When payment is due and how it is made.",
      maxLength: 2000,
      required: true,
      visible: true,
    },
    notes: {
      type: "text",
      label: "Notes",
      description: "Anything the customer's accounts team needs beyond the terms.",
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
      label: "Amount due",
      description: "What the customer owes.",
      value: {
        amount: "fields.subtotalAmount + fields.subtotalAmount * fields.taxRatePercent / 100",
        currency: "fields.currency",
      },
    },
  },
  defaultLayer: INVOICE_REACT_LAYER,
  layers: {
    [INVOICE_REACT_LAYER]: {
      kind: "file",
      mimeType: "text/tsx",
      path: INVOICE_REACT_LAYER_PATH,
      title: "Composition",
      description:
        "The React composition this invoice is. It declares no signature slot: an invoice is a demand for payment, not an agreement, so there is nothing on it to sign.",
    },
  },
} as const;

/** The parsed, validated invoice form. */
export const invoice = p.form(invoiceSpec);

/**
 * The same validated artifact as a plain `Form`. Everything that renders or
 * evaluates the invoice reads this, so no consumer sees the unparsed spec.
 */
export const invoiceForm: Form = invoice.toJSON() as Form;
