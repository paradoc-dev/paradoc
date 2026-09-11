/**
 * The Arabic reference document: a short order-confirmation letter with a
 * priced table, written right to left.
 *
 * Sample material, like the rest of `./examples`. Its purpose is evidence. The
 * proposal proves that one tree is the preview and the PDF; this one asks
 * whether that still holds when the script changes everything about how the
 * page is laid out — which edge a line starts on, which end of a row the first
 * column sits at, and which faces have to be embedded for a glyph to exist at
 * all.
 *
 * It is deliberately a second document rather than a translation of the first.
 * A translated proposal would share its geometry and prove only that the words
 * changed; a letter with its own masthead, its own paragraph and its own
 * schedule of items paginates on its own terms, which is what a right-to-left
 * page has to be measured on.
 *
 * **It declares its script, and the caller has to hand it over.** Direction,
 * language and typeface are root-only tokens, and the element walk that reads
 * them cannot see inside a composition. So `arabicLetterTokens` is exported and
 * passed in — the same contract `brandedProposalTokens` has — rather than being
 * hidden inside the tree, where `RootTokenMismatchError` would catch it. See
 * "Branding" in the README.
 */

import { p } from "@paradoc/core";
import type { Form } from "@paradoc/types";

import { ARABIC_FONT_NAME } from "@paradoc/react";
import type { DocumentTokensInput } from "@paradoc/react";

/** The layer that names the composition. */
export const ARABIC_LETTER_REACT_LAYER = "composition";

/**
 * The composition module the React layer points at, relative to this file.
 *
 * The same convention the proposal follows: the string is the key a consumer
 * binds the component under, so it is exported rather than written twice.
 */
export const ARABIC_LETTER_REACT_LAYER_PATH = "arabic-letter-document.tsx";

/**
 * Everything the letter changes about the default document.
 *
 * Three tokens, and they are one decision: the language it is written in, the
 * direction that language runs, and the family that carries the script. The
 * paper stays US Letter with the package's own margin, so the difference
 * between this document and the proposal is the script rather than the page.
 */
export const arabicLetterTokens: DocumentTokensInput = {
  fontFamily: ARABIC_FONT_NAME,
  dir: "rtl",
  lang: "ar",
};

/** The letter form, exactly as authored. */
export const arabicLetterSpec = {
  $schema: "https://schema.paradoc.dev/schema.json",
  kind: "form",
  name: "arabic-order-confirmation",
  version: "1.0.0",
  title: "خطاب تأكيد طلب شراء",
  description:
    "A short Arabic order-confirmation letter: a masthead, an addressee, one paragraph, a priced schedule of items with computed totals, and a closing.",
  metadata: {
    domain: "commerce",
  },
  parties: {
    sender: {
      label: "الجهة المرسِلة",
      description: "The organization confirming the order.",
      partyType: "organization",
      min: 1,
      max: 1,
      signature: { required: false, witnesses: 0, notarized: false },
    },
    recipient: {
      label: "الجهة المرسَل إليها",
      description: "The organization the letter is addressed to.",
      partyType: "organization",
      min: 1,
      max: 1,
      signature: { required: false, witnesses: 0, notarized: false },
    },
  },
  fields: {
    letterNumber: {
      type: "text",
      label: "رقم الخطاب",
      description: "Reference the sender files this letter under.",
      maxLength: 40,
      required: true,
      visible: true,
    },
    issuedOn: {
      type: "date",
      label: "التاريخ",
      description: "Date the letter was issued.",
      required: true,
      visible: true,
    },
    sender: {
      type: "organization",
      label: "الجهة المرسِلة",
      description: "Legal name of the organization sending the letter.",
      required: true,
      visible: true,
    },
    senderAddress: {
      type: "address",
      label: "العنوان",
      description: "Principal business address of the sender.",
      required: true,
      visible: true,
    },
    senderPhone: {
      type: "phone",
      label: "الهاتف",
      description: "Contact number for questions about the order.",
      required: false,
      visible: true,
    },
    recipient: {
      type: "organization",
      label: "الجهة المرسَل إليها",
      description: "The organization the letter is addressed to.",
      required: true,
      visible: true,
    },
    recipientContact: {
      type: "person",
      label: "عناية",
      description: "The person at the recipient the letter is directed to.",
      required: true,
      visible: true,
    },
    recipientAddress: {
      type: "address",
      label: "عنوان المرسَل إليه",
      description: "Address of the recipient.",
      required: true,
      visible: true,
    },
    body: {
      type: "text",
      label: "نص الخطاب",
      description: "The letter itself, one paragraph.",
      maxLength: 2000,
      required: true,
      visible: true,
    },
    currency: {
      type: "text",
      label: "العملة",
      description: "ISO 4217 currency code every amount in the letter is quoted in.",
      pattern: "^[A-Z]{3}$",
      required: true,
      visible: true,
    },
    items: {
      type: "list",
      label: "بنود الطلب",
      description: "The confirmed items, one row each.",
      minItems: 1,
      required: true,
      visible: true,
      item: {
        type: "fieldset",
        label: "بند",
        fields: {
          description: {
            type: "text",
            label: "البند",
            maxLength: 300,
            required: true,
            visible: true,
          },
          quantity: {
            type: "number",
            label: "الكمية",
            min: 0,
            required: true,
            visible: true,
          },
          unit: {
            type: "text",
            label: "الوحدة",
            maxLength: 20,
            required: true,
            visible: true,
          },
          unitPrice: {
            type: "money",
            label: "سعر الوحدة",
            min: 0,
            required: true,
            visible: true,
          },
          amount: {
            type: "money",
            label: "المبلغ",
            min: 0,
            required: true,
            visible: true,
          },
        },
      },
    },
    subtotalAmount: {
      type: "number",
      label: "الإجمالي قبل الضريبة",
      description:
        "Sum of the item amounts. Materialized by the caller for the reason the proposal's is: the expression language has no aggregate over a list.",
      min: 0,
      required: true,
      visible: false,
    },
    taxRatePercent: {
      type: "percentage",
      label: "نسبة الضريبة",
      description: "Value-added tax rate applied to the subtotal.",
      min: 0,
      max: 100,
      required: true,
      visible: true,
    },
    closing: {
      type: "text",
      label: "الخاتمة",
      description: "The closing courtesy.",
      maxLength: 400,
      required: true,
      visible: true,
    },
  },
  defs: {
    subtotal: {
      type: "money",
      label: "الإجمالي قبل الضريبة",
      description: "The item total before tax.",
      value: {
        amount: "fields.subtotalAmount",
        currency: "fields.currency",
      },
    },
    tax: {
      type: "money",
      label: "ضريبة القيمة المضافة",
      description: "Value-added tax on the subtotal at the quoted rate.",
      value: {
        amount: "fields.subtotalAmount * fields.taxRatePercent / 100",
        currency: "fields.currency",
      },
    },
    total: {
      type: "money",
      label: "الإجمالي المستحق",
      description: "Amount due.",
      value: {
        amount: "fields.subtotalAmount + fields.subtotalAmount * fields.taxRatePercent / 100",
        currency: "fields.currency",
      },
    },
  },
  defaultLayer: ARABIC_LETTER_REACT_LAYER,
  layers: {
    [ARABIC_LETTER_REACT_LAYER]: {
      kind: "file",
      mimeType: "text/tsx",
      path: ARABIC_LETTER_REACT_LAYER_PATH,
      title: "Composition",
      description:
        "The React composition this letter is. It declares no signature slot: the letter is a confirmation, not an agreement, and the seal path is exercised by the proposal.",
    },
  },
} as const;

/** The parsed, validated letter form. */
export const arabicLetter = p.form(arabicLetterSpec);

/** The same validated artifact as a plain `Form`. */
export const arabicLetterForm: Form = arabicLetter.toJSON() as Form;
