import { p } from "@paradoc/core";
import { describe, expect, it } from "vitest";

import {
  arabicLetterData,
  arabicLetterSpec,
  invoiceSpec,
  proposalSpec,
  purchaseOrderData,
  purchaseOrderSpec,
  shortInvoiceData,
  shortProposalData,
} from "../src/examples";

/**
 * Every sample artifact with computed money must evaluate at every point of a
 * fill, not only when it is complete.
 *
 * Core refuses to fill a form whose defs do not evaluate, and arithmetic over a
 * missing value is an evaluation error. A def that multiplies a field nobody
 * has answered yet therefore blocks a session before its first question. The
 * guarded defs read as null until their inputs land, and compute exactly once
 * they have.
 */

interface Money {
  amount: unknown;
  currency: unknown;
}

const EXAMPLES = [
  { name: "purchase order", spec: purchaseOrderSpec, data: purchaseOrderData },
  { name: "proposal", spec: proposalSpec, data: shortProposalData },
  { name: "arabic letter", spec: arabicLetterSpec, data: arabicLetterData },
  { name: "invoice", spec: invoiceSpec, data: shortInvoiceData },
] as const;

function evaluate(spec: unknown, fields: Record<string, unknown>) {
  const form = p.form(spec as Parameters<typeof p.form>[0]);
  const draft = form.safeFill({ fields, parties: {} } as never);
  if (!draft.success) throw new Error(`the fill did not parse: ${draft.error.message}`);
  const state = draft.data.runtimeState;
  const money = (key: string) => state.defsValues.get(key) as Money | undefined;
  return { resolved: state.resolved, issues: state.issues, money };
}

describe.each(EXAMPLES)("the $name's computed money", ({ spec, data }) => {
  it("evaluates before anything is answered, with no tax or total yet", () => {
    const { resolved, issues, money } = evaluate(spec, {});
    expect(issues).toEqual([]);
    expect(resolved).toBe(true);
    expect(money("tax")?.amount).toBeNull();
    expect(money("total")?.amount).toBeNull();
  });

  it("evaluates with every answer but the tax rate, with no tax or total yet", () => {
    const { taxRatePercent: _rate, ...rest } = data.fields;
    const { resolved, money } = evaluate(spec, rest);
    expect(resolved).toBe(true);
    expect(money("tax")?.amount).toBeNull();
    expect(money("total")?.amount).toBeNull();
  });

  it("computes tax and total once every input has landed", () => {
    const { resolved, money } = evaluate(spec, data.fields);
    expect(resolved).toBe(true);
    const tax = Number(money("tax")?.amount);
    const total = Number(money("total")?.amount);
    const subtotal = Number(money("subtotal")?.amount);
    expect(tax).toBeGreaterThan(0);
    expect(total).toBeCloseTo(subtotal + tax, 2);
  });
});

describe("the purchase order's totals", () => {
  it("are the sample's exact figures", () => {
    const { money } = evaluate(purchaseOrderSpec, purchaseOrderData.fields);
    expect(Number(money("subtotal")?.amount)).toBe(121_766);
    expect(Number(money("tax")?.amount)).toBeCloseTo(10_045.695, 3);
    expect(Number(money("total")?.amount)).toBeCloseTo(131_811.695, 3);
  });
});
