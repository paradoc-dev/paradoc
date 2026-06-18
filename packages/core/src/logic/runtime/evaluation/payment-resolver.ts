/**
 * Resolves a party's declared payment requirement to a concrete amount.
 *
 * A `FormParty.payment` declares either a fixed `Money` (amount + currency known
 * at authoring time) or a `MoneyExpression` whose amount/currency resolve from
 * the respondent's filled data at request time. The variable case reuses the
 * SAME expression engine that drives field `visible`/`required` — there is no
 * parallel evaluator: the two component expressions (`amount`, `currency`) are
 * evaluated against the form's evaluation context (`fields.*`, defs keys, etc.).
 */

import type { Form, FormPayment, Money, MoneyExpression } from '@paradoc/types'
import { buildFormContext, type FormDataPayload } from './context-builder'
import { evaluateExpression } from './expression-evaluator'

/** Outcome of resolving a payment requirement against filled data. */
export interface ResolvedPayment {
  /** Whether this payment is required (from the declaration; defaults false). */
  required: boolean
  /** The resolved monetary amount + currency. */
  amount: Money
}

/**
 * A fixed `Money` has `amount: number` + `currency: string` directly and no
 * `type`; a `MoneyExpression` is tagged `type: 'money'` with a `value` object of
 * expression strings. The tag is the unambiguous discriminator.
 */
function isMoneyExpression(
  amount: FormPayment['amount']
): amount is MoneyExpression {
  return (amount as MoneyExpression).type === 'money'
}

/**
 * Resolve a `FormPayment` to a concrete `Money` using the form + filled data.
 *
 * - Fixed `Money`: returned as-is.
 * - `MoneyExpression`: each component expression is evaluated against the form
 *   context. The amount must evaluate to a finite number and the currency to a
 *   3-letter string, or resolution throws — a payment with an unresolved amount
 *   must never be created silently.
 *
 * @throws Error when a variable amount cannot be resolved to a valid amount+currency.
 */
export function resolvePartyPayment(
  form: Form,
  payment: FormPayment,
  data: FormDataPayload
): ResolvedPayment {
  const required = payment.required ?? false

  if (!isMoneyExpression(payment.amount)) {
    return { required, amount: payment.amount }
  }

  const context = buildFormContext(form, data)
  const expr = payment.amount

  const amountResult = evaluateExpression<unknown>(expr.value.amount, context)
  if (!amountResult.success) {
    throw new Error(
      `Could not resolve the payment amount expression "${expr.value.amount}": ${amountResult.error}`
    )
  }
  // A missing/unresolved amount is null under the engine's null-safe semantics;
  // reject it explicitly so it cannot be coerced (Number(null) === 0) into a
  // silent zero-amount payment.
  if (amountResult.value === null || amountResult.value === undefined) {
    throw new Error(
      `The payment amount expression "${expr.value.amount}" did not resolve to a value.`
    )
  }
  const amount = Number(amountResult.value)
  if (!Number.isFinite(amount)) {
    throw new Error(
      `The payment amount expression "${expr.value.amount}" did not resolve to a finite number (got ${String(amountResult.value)}).`
    )
  }

  const currencyResult = evaluateExpression<unknown>(expr.value.currency, context)
  if (!currencyResult.success) {
    throw new Error(
      `Could not resolve the payment currency expression "${expr.value.currency}": ${currencyResult.error}`
    )
  }
  const currency = String(currencyResult.value)
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error(
      `The payment currency expression "${expr.value.currency}" did not resolve to an ISO 4217 alpha-3 code (got "${currency}").`
    )
  }

  return { required, amount: { amount, currency } }
}
