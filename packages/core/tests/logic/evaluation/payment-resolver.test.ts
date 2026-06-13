import { describe, test, expect } from 'vitest'
import { resolvePartyPayment } from '@/logic/runtime/evaluation/payment-resolver'
import type { Form, FormPayment } from '@paradoc/types'

/**
 * Tests for payment-resolver.ts — resolving a declared `FormParty.payment` to a
 * concrete amount.
 *
 * Why these assertions matter: a payment requirement is money to be collected,
 * so the resolved amount + currency must be EXACTLY what the declaration (fixed)
 * or the respondent's filled data (variable) dictates. A wrong amount silently
 * over- or under-charges a payer; a wrong currency moves the wrong money. We
 * assert the resolved values, never "did it run".
 */
describe('resolvePartyPayment', () => {
  const formWithAmountField = (): Form => ({
    kind: 'form',
    name: 'invoice',
    version: '1.0.0',
    title: 'Invoice',
    fields: {
      total: { type: 'number' },
      currencyCode: { type: 'text' },
    },
  })

  test('fixed Money resolves to that exact amount and currency, verbatim', () => {
    const form = formWithAmountField()
    const payment: FormPayment = {
      required: true,
      amount: { amount: 49.99, currency: 'USD' },
    }

    const resolved = resolvePartyPayment(form, payment, { fields: {} })

    expect(resolved.required).toBe(true)
    expect(resolved.amount).toEqual({ amount: 49.99, currency: 'USD' })
  })

  test('required defaults to false when the declaration omits it', () => {
    const form = formWithAmountField()
    const payment: FormPayment = { amount: { amount: 10, currency: 'EUR' } }

    const resolved = resolvePartyPayment(form, payment, { fields: {} })

    expect(resolved.required).toBe(false)
    expect(resolved.amount).toEqual({ amount: 10, currency: 'EUR' })
  })

  test('MoneyExpression resolves the amount AND currency from the filled field data', () => {
    const form = formWithAmountField()
    const payment: FormPayment = {
      required: true,
      amount: {
        type: 'money',
        value: { amount: 'fields.total', currency: 'fields.currencyCode' },
      },
    }

    // The respondent filled total=1234.50 and currency=GBP; the payment owed
    // must equal those filled values, not the declaration (there is none).
    const resolved = resolvePartyPayment(form, payment, {
      fields: { total: 1234.5, currencyCode: 'GBP' },
    })

    expect(resolved.required).toBe(true)
    expect(resolved.amount).toEqual({ amount: 1234.5, currency: 'GBP' })
  })

  test('MoneyExpression amount can be a computation over multiple fields', () => {
    const form: Form = {
      kind: 'form',
      name: 'order',
      version: '1.0.0',
      title: 'Order',
      fields: {
        unitPrice: { type: 'number' },
        quantity: { type: 'number' },
      },
    }
    const payment: FormPayment = {
      amount: {
        type: 'money',
        // currency is a literal expression (a quoted string), amount is derived.
        value: { amount: 'fields.unitPrice * fields.quantity', currency: '"USD"' },
      },
    }

    const resolved = resolvePartyPayment(form, payment, {
      fields: { unitPrice: 19.95, quantity: 3 },
    })

    expect(resolved.amount.amount).toBeCloseTo(59.85, 5)
    expect(resolved.amount.currency).toBe('USD')
  })

  test('throws when a variable amount does not resolve to a finite number', () => {
    const form = formWithAmountField()
    const payment: FormPayment = {
      amount: {
        type: 'money',
        value: { amount: 'fields.total', currency: 'fields.currencyCode' },
      },
    }

    // total is missing from the filled data → the amount is unresolvable. A
    // payment must never be created with a silently-coerced amount.
    expect(() =>
      resolvePartyPayment(form, payment, { fields: { currencyCode: 'USD' } })
    ).toThrow(/amount/i)
  })

  test('throws when a variable currency does not resolve to an ISO 4217 code', () => {
    const form = formWithAmountField()
    const payment: FormPayment = {
      amount: {
        type: 'money',
        value: { amount: 'fields.total', currency: 'fields.currencyCode' },
      },
    }

    expect(() =>
      resolvePartyPayment(form, payment, {
        fields: { total: 100, currencyCode: 'dollars' },
      })
    ).toThrow(/currency/i)
  })
})
