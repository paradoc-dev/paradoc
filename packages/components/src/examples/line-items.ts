/**
 * Line-item arithmetic.
 *
 * Multiplies each row out. The subtotal, tax, and total are the artifact's own
 * defs, which sum these amounts with `sum(fields.lineItems.amount)`.
 */

import type { Money } from "@paradoc/types";

/** One priced row of the proposal, before its amount is computed. */
export interface LineItemInput {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: Money;
}

/** One priced row with its computed amount. */
export interface LineItem extends LineItemInput {
  amount: Money;
}

function round(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Multiplies every row out and returns the rows with their amounts. */
export function computeLineAmounts(
  items: readonly LineItemInput[],
  currency: string
): { lineItems: LineItem[] } {
  const lineItems = items.map((item) => ({
    ...item,
    amount: { amount: round(item.quantity * item.unitPrice.amount), currency },
  }));
  return { lineItems };
}
