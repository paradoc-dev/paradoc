/**
 * Line-item arithmetic.
 *
 * The expression language indexes a list and reads its length, but it has no
 * aggregate over one, so a subtotal cannot be written as a def. This helper
 * closes that one gap: it multiplies each row out and sums the rows. Tax and
 * total stay in the artifact, computed from the subtotal it returns.
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

/** Multiplies every row out and returns the rows with their amounts plus the subtotal. */
export function computeLineAmounts(
  items: readonly LineItemInput[],
  currency: string
): { lineItems: LineItem[]; subtotalAmount: number } {
  const lineItems = items.map((item) => ({
    ...item,
    amount: { amount: round(item.quantity * item.unitPrice.amount), currency },
  }));
  const subtotalAmount = round(lineItems.reduce((sum, item) => sum + item.amount.amount, 0));
  return { lineItems, subtotalAmount };
}
