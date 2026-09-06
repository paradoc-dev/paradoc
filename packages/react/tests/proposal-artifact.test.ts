import { describe, expect, it } from "vitest";
import { evaluateFormDefs } from "@paradoc/core";
import {
  proposal,
  proposalForm,
  PROPOSAL_REACT_LAYER,
  PROPOSAL_REACT_LAYER_PATH,
  PROPOSAL_SIGNATURE_SLOTS,
  overflowProposalData,
  shortProposalData,
} from "../src/examples";
import { computeLineAmounts } from "../src/lib/totals";

describe("the proposal artifact", () => {
  it("parses and declares both signing parties", () => {
    expect(Object.keys(proposal.parties ?? {})).toEqual(["provider", "customer"]);
    expect(proposal.parties?.provider.signature?.required).toBe(true);
    expect(proposal.parties?.customer.signature?.required).toBe(true);
  });

  it("names its composition in a React layer that carries no content", () => {
    // The React tree is the only layout description, which is the
    // specification's central invariant. The layer that declares it is a
    // pointer to the module and nothing more: no text and no bindings.
    const layer = proposalForm.layers?.[PROPOSAL_REACT_LAYER];
    if (!layer || layer.kind !== "file") throw new Error("the composition layer is not a file layer");
    expect(layer.mimeType).toBe("text/tsx");
    expect(layer.path).toBe(PROPOSAL_REACT_LAYER_PATH);
    expect(layer.bindings).toBeUndefined();
    expect(layer).not.toHaveProperty("text");
  });

  it("declares one layer, and that layer is the seal target too", () => {
    // The composition is the whole artifact's rendering surface. There is no
    // auxiliary layer holding signature placeholders: the slots sit on the
    // composition and the renderer draws their markers.
    expect(Object.keys(proposalForm.layers ?? {})).toEqual([PROPOSAL_REACT_LAYER]);
    expect(proposalForm.defaultLayer).toBe(PROPOSAL_REACT_LAYER);

    const layer = proposalForm.layers?.[PROPOSAL_REACT_LAYER];
    expect(Object.keys(layer?.signatures ?? {})).toEqual(Object.values(PROPOSAL_SIGNATURE_SLOTS));
    for (const slot of Object.values(layer?.signatures ?? {})) {
      expect(slot.placement).toBe("flow");
      expect(slot.type).toBe("signature");
    }
    // Each slot names the party it binds to, which is the whole binding: the
    // seal puts the marker on the Signature block for that role.
    expect(layer?.signatures?.[PROPOSAL_SIGNATURE_SLOTS.provider]?.party).toEqual({ role: "provider" });
    expect(layer?.signatures?.[PROPOSAL_SIGNATURE_SLOTS.customer]?.party).toEqual({ role: "customer" });
  });

  it("accepts both sample data sets, so DocumentData is the payload core expects", () => {
    expect(proposal.safeParseData(shortProposalData as never).success).toBe(true);
    expect(proposal.safeParseData(overflowProposalData as never).success).toBe(true);
  });

  it("computes subtotal, tax and total from its own expressions", () => {
    const result = evaluateFormDefs(proposalForm, {
      fields: shortProposalData.fields,
      parties: shortProposalData.parties,
    });
    if (!("value" in result) || !result.value) throw new Error("the defs did not evaluate");

    const subtotal = result.value.defsValues.get("subtotal") as { amount: number; currency: string };
    const tax = result.value.defsValues.get("tax") as { amount: number };
    const total = result.value.defsValues.get("total") as { amount: number };

    expect(subtotal.currency).toBe("USD");
    expect(subtotal.amount).toBe(shortProposalData.fields.subtotalAmount);
    expect(tax.amount).toBeCloseTo(subtotal.amount * 0.0825, 6);
    expect(total.amount).toBeCloseTo(subtotal.amount + tax.amount, 6);
  });
});

describe("the sample data holds the page budget", () => {
  it("keeps the short set small enough to fit one page", () => {
    expect((shortProposalData.fields.lineItems as unknown[]).length).toBe(4);
  });

  it("keeps the overflow set large enough to run past three pages", () => {
    expect((overflowProposalData.fields.lineItems as unknown[]).length).toBe(66);
  });
});

describe("line-item arithmetic", () => {
  it("multiplies each row out and sums the rows", () => {
    const { lineItems, subtotalAmount } = computeLineAmounts(
      [
        { description: "A", quantity: 3, unit: "day", unitPrice: { amount: 100.5, currency: "USD" } },
        { description: "B", quantity: 2, unit: "day", unitPrice: { amount: 50.25, currency: "USD" } },
      ],
      "USD"
    );
    expect(lineItems[0]!.amount).toEqual({ amount: 301.5, currency: "USD" });
    expect(lineItems[1]!.amount).toEqual({ amount: 100.5, currency: "USD" });
    expect(subtotalAmount).toBe(402);
  });
});
