/**
 * What the invoice artifact promises, checked on the artifact itself.
 *
 * The same claims `proposal-artifact.test.ts` makes for the proposal, plus the
 * one that is this document's own: an invoice is a demand for payment rather
 * than an agreement, so neither party signs it and its layer declares no slot.
 * A signature slot appearing here would mean the sample had quietly become a
 * different kind of document.
 */

import { evaluateFormDefs, validateArtifact } from "@paradoc/core";
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
} from "../../components/src/examples";

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

  type Money = { amount: number; currency: string };
  type Row = { taxable: boolean; amount: Money };

  function totals(lineItems: Row[]) {
    const result = evaluateFormDefs(invoiceForm, {
      fields: { ...shortInvoiceData.fields, lineItems },
      parties: shortInvoiceData.parties,
    });
    if (!("value" in result) || !result.value) throw new Error("the defs did not evaluate");
    const defs = result.value.defsValues;
    return {
      issues: result.value.issues,
      subtotal: defs.get("subtotal") as Money,
      taxableSubtotal: defs.get("taxableSubtotal") as Money,
      tax: defs.get("tax") as Money,
      total: defs.get("total") as Money,
    };
  }

  const shortRows = shortInvoiceData.fields.lineItems as Row[];

  it("passes authoring validation, aggregates included", () => {
    expect(validateArtifact(invoiceForm)).toEqual({ value: invoiceForm });
  });

  it("derives its subtotal from the line items, with no hand-entered total", () => {
    // 6 x 2200 + 11 x 2050 + 4 x 2050 + 3 x 1900 + 1 x 3400.
    const { subtotal, tax, total } = totals(shortRows);
    expect(subtotal).toEqual({ amount: 53050, currency: "USD" });
    expect(tax.amount).toBeCloseTo(53050 * 0.0825, 6);
    expect(total.amount).toBeCloseTo(53050 * 1.0825, 6);
    expect(Object.keys(invoiceForm.fields ?? {})).not.toContain("subtotalAmount");
  });

  it("taxes only the rows marked taxable", () => {
    // The subscription row, 3400, is not taxable.
    const rows = shortRows.map((row, index) => (index === 4 ? { ...row, taxable: false } : row));
    const { subtotal, taxableSubtotal, tax, total } = totals(rows);
    expect(subtotal.amount).toBe(53050);
    expect(taxableSubtotal).toEqual({ amount: 49650, currency: "USD" });
    expect(tax.amount).toBeCloseTo(49650 * 0.0825, 6);
    expect(total.amount).toBeCloseTo(53050 + 49650 * 0.0825, 6);
  });

  it("taxes nothing when no row is taxable", () => {
    const { taxableSubtotal, tax } = totals(shortRows.map((row) => ({ ...row, taxable: false })));
    expect(taxableSubtotal.amount).toBe(0);
    expect(tax.amount).toBe(0);
  });

  it("refuses to add a row billed in another currency", () => {
    const rows = [...shortRows, { ...shortRows[0]!, amount: { amount: 10, currency: "EUR" } }];
    const result = evaluateFormDefs(invoiceForm, { fields: { ...shortInvoiceData.fields, lineItems: rows } });
    expect("value" in result && result.value.issues[0]?.message).toMatch(/more than one currency: EUR, USD/);
    expect("value" in result && result.value.defsValues.get("subtotal")).toBeNull();
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
    // and a set that named root-only document settings could not be layered there.
    expect(invoiceTokens.pageSize).toBeUndefined();
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
