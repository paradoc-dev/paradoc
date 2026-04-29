/**
 * Tests for Handlebars comparison/logic helpers and signatureDate helper
 */

import { describe, test, expect } from 'vitest'
import { renderText } from '../src/render'

describe('comparison helpers', () => {
  test('eq: returns true when values are equal', () => {
    const output = renderText({
      template: '{{#if (eq type "recurring")}}YES{{else}}NO{{/if}}',
      data: { type: 'recurring' },
    })
    expect(output).toBe('YES')
  })

  test('eq: returns false when values differ', () => {
    const output = renderText({
      template: '{{#if (eq type "recurring")}}YES{{else}}NO{{/if}}',
      data: { type: 'one-time' },
    })
    expect(output).toBe('NO')
  })

  test('ne: returns true when values differ', () => {
    const output = renderText({
      template: '{{#if (ne status "closed")}}OPEN{{else}}CLOSED{{/if}}',
      data: { status: 'active' },
    })
    expect(output).toBe('OPEN')
  })

  test('ne: returns false when values are equal', () => {
    const output = renderText({
      template: '{{#if (ne status "closed")}}OPEN{{else}}CLOSED{{/if}}',
      data: { status: 'closed' },
    })
    expect(output).toBe('CLOSED')
  })

  test('gt: returns true when a > b', () => {
    const output = renderText({
      template: '{{#if (gt count 5)}}MORE{{else}}LESS{{/if}}',
      data: { count: 10 },
    })
    expect(output).toBe('MORE')
  })

  test('gt: returns false when a <= b', () => {
    const output = renderText({
      template: '{{#if (gt count 5)}}MORE{{else}}LESS{{/if}}',
      data: { count: 3 },
    })
    expect(output).toBe('LESS')
  })

  test('gte: returns true when a >= b', () => {
    const output = renderText({
      template: '{{#if (gte count 5)}}YES{{else}}NO{{/if}}',
      data: { count: 5 },
    })
    expect(output).toBe('YES')
  })

  test('lt: returns true when a < b', () => {
    const output = renderText({
      template: '{{#if (lt count 5)}}LESS{{else}}MORE{{/if}}',
      data: { count: 3 },
    })
    expect(output).toBe('LESS')
  })

  test('lte: returns true when a <= b', () => {
    const output = renderText({
      template: '{{#if (lte count 5)}}YES{{else}}NO{{/if}}',
      data: { count: 5 },
    })
    expect(output).toBe('YES')
  })

  test('not: inverts truthy to false', () => {
    const output = renderText({
      template: '{{#if (not isActive)}}INACTIVE{{else}}ACTIVE{{/if}}',
      data: { isActive: true },
    })
    expect(output).toBe('ACTIVE')
  })

  test('not: inverts falsy to true', () => {
    const output = renderText({
      template: '{{#if (not isActive)}}INACTIVE{{else}}ACTIVE{{/if}}',
      data: { isActive: false },
    })
    expect(output).toBe('INACTIVE')
  })

  test('and: returns true when all arguments are truthy', () => {
    const output = renderText({
      template: '{{#if (and hasA hasB)}}BOTH{{else}}NOT{{/if}}',
      data: { hasA: true, hasB: true },
    })
    expect(output).toBe('BOTH')
  })

  test('and: returns false when some arguments are falsy', () => {
    const output = renderText({
      template: '{{#if (and hasA hasB)}}BOTH{{else}}NOT{{/if}}',
      data: { hasA: true, hasB: false },
    })
    expect(output).toBe('NOT')
  })

  test('or: returns true when some arguments are truthy', () => {
    const output = renderText({
      template: '{{#if (or hasA hasB)}}YES{{else}}NO{{/if}}',
      data: { hasA: false, hasB: true },
    })
    expect(output).toBe('YES')
  })

  test('or: returns false when all arguments are falsy', () => {
    const output = renderText({
      template: '{{#if (or hasA hasB)}}YES{{else}}NO{{/if}}',
      data: { hasA: false, hasB: false },
    })
    expect(output).toBe('NO')
  })

  test('contains: returns true when array includes value', () => {
    const output = renderText({
      template: '{{#if (contains tags "urgent")}}URGENT{{else}}NORMAL{{/if}}',
      data: { tags: ['urgent', 'review'] },
    })
    expect(output).toBe('URGENT')
  })

  test('contains: returns false when array does not include value', () => {
    const output = renderText({
      template: '{{#if (contains tags "urgent")}}URGENT{{else}}NORMAL{{/if}}',
      data: { tags: ['review'] },
    })
    expect(output).toBe('NORMAL')
  })

  test('contains: returns false for non-array', () => {
    const output = renderText({
      template: '{{#if (contains tags "urgent")}}URGENT{{else}}NORMAL{{/if}}',
      data: { tags: 'not-an-array' },
    })
    expect(output).toBe('NORMAL')
  })

  test('default: returns value when present', () => {
    const output = renderText({
      template: '{{default name "N/A"}}',
      data: { name: 'Alice' },
    })
    expect(output).toBe('Alice')
  })

  test('default: returns fallback for null', () => {
    const output = renderText({
      template: '{{default name "N/A"}}',
      data: { name: null },
    })
    expect(output).toBe('N/A')
  })

  test('default: returns fallback for undefined', () => {
    const output = renderText({
      template: '{{default name "N/A"}}',
      data: {},
    })
    expect(output).toBe('N/A')
  })

  test('default: returns fallback for empty string', () => {
    const output = renderText({
      template: '{{default name "N/A"}}',
      data: { name: '' },
    })
    expect(output).toBe('N/A')
  })

  test('checkbox pattern with eq subexpression', () => {
    const output = renderText({
      template: '[{{#if (eq val "x")}}X{{else}} {{/if}}]',
      data: { val: 'x' },
    })
    expect(output).toBe('[X]')
  })

  test('checkbox pattern unchecked', () => {
    const output = renderText({
      template: '[{{#if (eq val "x")}}X{{else}} {{/if}}]',
      data: { val: '' },
    })
    expect(output).toBe('[ ]')
  })
})

describe('signatureDate helper', () => {
  const makePartyData = (captures?: unknown[]) => ({
    _role: 'tenant',
    id: 'tenant-1',
    signatories: [
      {
        signerId: 'signer-1',
        capacity: 'Individual',
        signer: {
          id: 'signer-1',
          person: { name: 'John Doe' },
        },
      },
    ],
    _captures: captures,
    _signers: {
      'signer-1': {
        id: 'signer-1',
        person: { name: 'John Doe' },
      },
    },
  })

  test('renders placeholder when no capture exists', () => {
    const data = makePartyData()
    const output = renderText({
      template: '{{#with this}}{{signatureDate "final-sig"}}{{/with}}',
      data,
    })
    expect(output).toBe('[DATE]')
  })

  test('renders date when capture exists', () => {
    const captures = [
      {
        role: 'tenant',
        partyId: 'tenant-1',
        signerId: 'signer-1',
        locationId: 'final-sig',
        type: 'signature',
        timestamp: '2024-06-15T14:30:00Z',
        method: 'drawn',
      },
    ]
    const data = makePartyData(captures)
    const output = renderText({
      template: '{{#with this}}{{signatureDate "final-sig"}}{{/with}}',
      data,
    })
    expect(output).toBe('2024-06-15')
  })

  test('renders custom placeholder text', () => {
    const data = makePartyData()
    const output = renderText({
      template: '{{#with this}}{{signatureDate "final-sig"}}{{/with}}',
      data,
      signatureOptions: {
        placeholder: { signatureDate: '___/___/______' },
      },
    })
    expect(output).toBe('___/___/______')
  })

  test('renders captured date as HTML with format html', () => {
    const captures = [
      {
        role: 'tenant',
        partyId: 'tenant-1',
        signerId: 'signer-1',
        locationId: 'final-sig',
        type: 'signature',
        timestamp: '2024-06-15T14:30:00Z',
        method: 'drawn',
      },
    ]
    const data = makePartyData(captures)
    // Use triple-stache to prevent HTML escaping (same as signature/initials helpers)
    const output = renderText({
      template: '{{#with this}}{{{signatureDate "final-sig"}}}{{/with}}',
      data,
      signatureOptions: { format: 'html' },
    })
    expect(output).toContain('<span class="signature-date"')
    expect(output).toContain('2024-06-15')
    expect(output).toContain('data-location-id="final-sig"')
  })

  test('renders placeholder as HTML with format html', () => {
    const data = makePartyData()
    // Use triple-stache to prevent HTML escaping
    const output = renderText({
      template: '{{#with this}}{{{signatureDate "final-sig"}}}{{/with}}',
      data,
      signatureOptions: { format: 'html' },
    })
    expect(output).toContain('<span class="signature-date-placeholder"')
    expect(output).toContain('[DATE]')
  })
})
