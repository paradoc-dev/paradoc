/**
 * The purchase order form artifact this package's reference document composes.
 *
 * Everything the document shows is declared here: the buyer and supplier, the
 * line-item list, the currency and tax inputs behind the computed totals, and
 * the two signing parties. The React components read this artifact and never
 * carry their own copy of a label, a format, or a total.
 *
 * It declares one layer, and that layer describes no layout. `composition` is
 * the document: a file layer of MIME type `text/tsx` naming the module that
 * holds the React tree. Nothing reads that file; `render` selecting the layer
 * dispatches to the renderer registered for `text/tsx`, which binds the module
 * and produces the PDF. The React tree is the only description of the document,
 * which is the specification's central invariant.
 *
 * The same layer is the seal target. It declares a flow-placed signature slot
 * per party, and the renderer registered for it draws the marker for each slot
 * where the `Signature` block for that party sits. Nothing else describes where
 * a signature goes.
 *
 * One limitation shapes the design. The expression language indexes lists and
 * reads their length, but it has no aggregate over a list, so a subtotal cannot be
 * expressed as a def. `subtotalAmount` is therefore a field the caller
 * materializes with `computeLineAmounts`, and the artifact computes tax and total
 * from it. See the package README.
 *
 * Unlike the proposal, this composition does not wrap itself in a `Bundle`: it
 * is designed to also sit inside a packet whose own layer supplies the bundle,
 * so it renders bare and lets the caller decide.
 */

import { para } from "@paradoc/core";
import type { Form } from "@paradoc/types";

/** The layer that names the composition, and the layer the seal targets. */
export const PURCHASE_ORDER_REACT_LAYER = "composition";

/**
 * The composition module the React layer points at, as the layer declares it.
 *
 * Relative to the artifact file that declares it, which is this one, so it names
 * the sibling module and nothing more. A consumer who renders the sample through
 * its layer either maps this path to `PurchaseOrderDocument` or lets the renderer
 * import it with `baseDir` set to this directory. Either way the string is the
 * key, so it is exported rather than written twice.
 */
export const PURCHASE_ORDER_REACT_LAYER_PATH = "purchase-order-document.tsx";

/**
 * The artifact's signature slots, by the party role each one binds to. A slot
 * names its role, so the seal puts each marker on the `Signature` block for that
 * role without anything mapping the two.
 */
export const PURCHASE_ORDER_SIGNATURE_SLOTS = {
  buyer: "buyer-signature",
  supplier: "supplier-signature",
} as const satisfies Record<string, string>;

/** The purchase order form, exactly as authored. Kept beside the instance for evaluators that take a raw `Form`. */
export const purchaseOrderSpec = {
  $schema: "https://schema.paradoc.dev/schema.json",
  kind: "form",
  name: "purchase-order",
  version: "1.0.0",
  title: "Purchase Order",
  description:
    "An order from a buyer to a supplier, with line items, computed totals, and signatures from both parties.",
  metadata: {
    domain: "commerce",
  },
  parties: {
    buyer: {
      label: "Buyer",
      description: "The organization placing the order and issuing payment.",
      partyType: "organization",
      min: 1,
      max: 1,
      signature: { required: true, witnesses: 0, notarized: false },
    },
    supplier: {
      label: "Supplier",
      description: "The organization fulfilling the order.",
      partyType: "organization",
      min: 1,
      max: 1,
      signature: { required: true, witnesses: 0, notarized: false },
    },
  },
  fields: {
    orderNumber: {
      type: "text",
      label: "Order number",
      description: "Identifier the buyer gives this order.",
      maxLength: 40,
      required: true,
      visible: true,
    },
    issuedOn: {
      type: "date",
      label: "Issued",
      description: "Date the buyer issued the order.",
      required: true,
      visible: true,
    },
    deliverBy: {
      type: "date",
      label: "Deliver by",
      description: "Date the order must be delivered by.",
      required: true,
      visible: true,
    },
    buyer: {
      type: "organization",
      label: "Buyer",
      description: "Legal name and identifiers of the ordering organization.",
      required: true,
      visible: true,
    },
    buyerAddress: {
      type: "address",
      label: "Buyer address",
      description: "Principal business address of the buyer.",
      required: true,
      visible: true,
    },
    buyerContact: {
      type: "person",
      label: "Buyer contact",
      description:
        "The person who signs for the buyer. `sealPurchaseOrder` reads this field to bind the buyer's signer, because core's Signer.person is always a Person and an organization cannot fill it. The composition does not print it: the document names the party, and who signed it is what the seal records. Not printing a field is the composition's decision, not the artifact's, so it is visible and a session collects it like any other required field.",
      required: true,
      visible: true,
    },
    supplier: {
      type: "organization",
      label: "Supplier",
      description: "The organization the order is addressed to.",
      required: true,
      visible: true,
    },
    supplierAddress: {
      type: "address",
      label: "Supplier address",
      description: "Principal business address of the supplier.",
      required: true,
      visible: true,
    },
    supplierContact: {
      type: "person",
      label: "Supplier contact",
      description:
        "The person at the supplier who receives the order, and the person who signs for it. `sealPurchaseOrder` reads this field to bind the supplier's signer.",
      required: true,
      visible: true,
    },
    shipTo: {
      type: "address",
      label: "Ship to",
      description: "Delivery address for the order.",
      required: true,
      visible: true,
    },
    currency: {
      type: "text",
      label: "Currency",
      description: "ISO 4217 currency code every amount on the order is quoted in.",
      pattern: "^[A-Z]{3}$",
      required: true,
      visible: true,
    },
    lineItems: {
      type: "list",
      label: "Line items",
      description: "The ordered goods and services, one row per item.",
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
              "The row multiplied out. Derived rather than answered, like `subtotalAmount` and for the same reason: a filler supplies the quantity and the unit price, and `computeLineAmounts` does the arithmetic. Requiring it would make a session ask a vendor to multiply.",
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
        "Sum of the line-item amounts. Materialized by the caller because the expression language has no list aggregate. Not shown as a field: the document surfaces it through the `subtotal` def, so the reader sees one serialized money value rather than a bare number. Derived rather than answered, exactly like each row's `amount`, and declared the same way: invisible so no session asks for it, and not required so nothing demands it of a filler. `purchaseOrderDocumentData` recomputes it from whatever line items have landed.",
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
    terms: {
      type: "text",
      label: "Terms",
      description: "Delivery and payment terms.",
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
      description: "Amount due for the order.",
      value: {
        amount: "fields.subtotalAmount + fields.subtotalAmount * fields.taxRatePercent / 100",
        currency: "fields.currency",
      },
    },
  },
  defaultLayer: PURCHASE_ORDER_REACT_LAYER,
  layers: {
    [PURCHASE_ORDER_REACT_LAYER]: {
      kind: "file",
      mimeType: "text/tsx",
      path: PURCHASE_ORDER_REACT_LAYER_PATH,
      title: "Composition",
      description:
        "The React composition this document is. The path is a pointer: nothing reads the file, and the renderer registered for text/tsx binds the module and seals it.",
      signatures: {
        [PURCHASE_ORDER_SIGNATURE_SLOTS.buyer]: {
          party: { role: "buyer" },
          type: "signature",
          label: "Buyer signature",
          placement: "flow",
        },
        [PURCHASE_ORDER_SIGNATURE_SLOTS.supplier]: {
          party: { role: "supplier" },
          type: "signature",
          label: "Supplier signature",
          placement: "flow",
        },
      },
    },
  },
} as const;

/** The parsed, validated purchase order form. */
export const purchaseOrder = para.form(purchaseOrderSpec);

/**
 * The same validated artifact as a plain `Form`. Everything that renders or
 * evaluates the purchase order reads this, so no consumer sees the unparsed spec.
 */
export const purchaseOrderForm: Form = purchaseOrder.toJSON() as Form;
