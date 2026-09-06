import { describe, expect, it } from "vitest";
import { evaluateFormDefs } from "@paradoc/core";
import {
  proposal,
  proposalForm,
  PROPOSAL_SIGNATURE_SLOTS,
  PROPOSAL_SIGNING_LAYER,
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

  it("declares one layer, and it describes no layout", () => {
    // The React tree is the only layout description, which is the
    // specification's central invariant. The seal flow will not place a slot a
    // layer does not declare, so the artifact carries the smallest layer that
    // satisfies it: two slot declarations, and one line per slot whose whole
    // content is the placeholder core renders. Nothing the document shows —
    // no title, no field, no heading, no total — appears here.
    expect(Object.keys(proposalForm.layers ?? {})).toEqual([PROPOSAL_SIGNING_LAYER]);
    // No defaultLayer: with one layer, core resolves the seal target to it.
    expect(proposalForm.defaultLayer).toBeUndefined();

    const layer = proposalForm.layers?.[PROPOSAL_SIGNING_LAYER];
    if (!layer || layer.kind !== "inline") throw new Error("the signing layer is not inline");
    expect(layer.mimeType).toBe("text/plain");
    expect(Object.keys(layer.signatures ?? {})).toEqual(Object.values(PROPOSAL_SIGNATURE_SLOTS));
    for (const slot of Object.values(layer.signatures ?? {})) {
      expect(slot.placement).toBe("flow");
      expect(slot.type).toBe("signature");
    }

    const lines = layer.text.split("\n");
    expect(lines).toHaveLength(Object.keys(PROPOSAL_SIGNATURE_SLOTS).length);
    for (const line of lines) {
      // A slot id, a tab, and one signature helper. Nothing else.
      expect(line).toMatch(
        /^[a-z-]+\t\{\{#with parties\.[a-z]+\}\}\{\{signature "[a-z-]+"\}\}\{\{\/with\}\}$/
      );
    }
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
