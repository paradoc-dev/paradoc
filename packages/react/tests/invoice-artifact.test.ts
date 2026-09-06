/**
 * What the invoice artifact promises, checked on the artifact itself.
 *
 * The same claims `proposal-artifact.test.ts` makes for the proposal, plus the
 * one that is this document's own: an invoice is a demand for payment rather
 * than an agreement, so neither party signs it and its layer declares no slot.
 * A signature slot appearing here would mean the sample had quietly become a
 * different kind of document.
 */

import { evaluateFormDefs } from "@paradoc/core";
import { describe, expect, it } from "vitest";

import {
  invoice,
  invoiceForm,
  invoiceTokens,
  overflowInvoiceData,
  shortInvoiceData,
  INVOICE_ACCENT_COLOR,
  INVOICE_REACT_LAYER,
  INVOICE_REACT_LAYER_PATH,
} from "../src/examples";

describe("the invoice artifact", () => {
  it("parses and declares both parties, neither of which signs", () => {
    expect(Object.keys(invoice.parties ?? {})).toEqual(["issuer", "customer"]);
    expect(invoice.parties?.issuer.signature?.required).toBe(false);
    expect(invoice.parties?.customer.signature?.required).toBe(false);
  });

  it("names its composition in a React layer that carries no content", () => {
    const layer = invoiceForm.layers?.[INVOICE_REACT_LAYER];
    if (!layer || layer.kind !== "file") throw new Error("the composition layer is not a file layer");
    expect(layer.mimeType).toBe("text/tsx");
    expect(layer.path).toBe(INVOICE_REACT_LAYER_PATH);
    expect(layer.bindings).toBeUndefined();
    expect(layer).not.toHaveProperty("text");
  });

  it("declares one layer, and that layer holds no signature slot", () => {
    // The document this sample is has nothing on it to sign. A slot here would
    // put a marker on a document no party is agreeing to.
    expect(Object.keys(invoiceForm.layers ?? {})).toEqual([INVOICE_REACT_LAYER]);
    expect(invoiceForm.defaultLayer).toBe(INVOICE_REACT_LAYER);
    expect(invoiceForm.layers?.[INVOICE_REACT_LAYER]?.signatures).toBeUndefined();
  });

  it("accepts both sample data sets, so DocumentData is the payload core expects", () => {
    expect(invoice.safeParseData(shortInvoiceData as never).success).toBe(true);
    expect(invoice.safeParseData(overflowInvoiceData as never).success).toBe(true);
  });

  it("computes subtotal, tax and amount due from its own expressions", () => {
    const result = evaluateFormDefs(invoiceForm, {
      fields: shortInvoiceData.fields,
      parties: shortInvoiceData.parties,
    });
    if (!("value" in result) || !result.value) throw new Error("the defs did not evaluate");

    const subtotal = result.value.defsValues.get("subtotal") as { amount: number; currency: string };
    const tax = result.value.defsValues.get("tax") as { amount: number };
    const total = result.value.defsValues.get("total") as { amount: number };

    expect(subtotal.currency).toBe("USD");
    expect(subtotal.amount).toBe(shortInvoiceData.fields.subtotalAmount);
    expect(tax.amount).toBeCloseTo(subtotal.amount * 0.0825, 6);
    expect(total.amount).toBeCloseTo(subtotal.amount + tax.amount, 6);
  });

  it("brands itself with a mark of its own, carried as bytes", () => {
    // Bytes rather than a file: the token resolves them to a `data:` URI, so
    // the invoice needs no image wiring on either side and a consumer who
    // installs the block gets a document that draws its own mark.
    expect(invoiceTokens.accentColor).toBe(INVOICE_ACCENT_COLOR);
    const logo = invoiceTokens.logo;
    if (!(logo instanceof Uint8Array)) throw new Error("the invoice's mark is not bytes");
    expect(Array.from(logo.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    // Nothing root-only: the composition hands this set to its own `Document`,
    // and a set that named the paper or the typeface could not be layered there.
    expect(invoiceTokens.pageSize).toBeUndefined();
    expect(invoiceTokens.fontFamily).toBeUndefined();
  });
});

describe("the sample data holds the page budget", () => {
  it("keeps the short set small enough to fit one page", () => {
    expect((shortInvoiceData.fields.lineItems as unknown[]).length).toBe(5);
  });

  it("keeps the overflow set large enough to run its table past two breaks", () => {
    expect((overflowInvoiceData.fields.lineItems as unknown[]).length).toBe(48);
  });
});
