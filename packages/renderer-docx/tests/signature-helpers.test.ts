/**
 * Unit tests for the docx signature helper factory.
 *
 * Tests the capacity and printedName helpers in isolation by calling
 * createDocxSignatureHelpers() directly and invoking the returned methods.
 */

import { describe, test, expect } from 'vitest'
import { createDocxSignatureHelpers } from '../src/utils/signature-helpers'

const makeRootData = (opts?: {
  capacity?: string
  name?: string
  captures?: unknown[]
}) => {
  const signer = {
    person: { name: opts?.name ?? 'Jane Smith' },
  }
  const signatory = {
    signerId: 'signer-1',
    capacity: opts?.capacity,
    signer,
    _role: 'taxpayer',
    _partyId: 'taxpayer-1',
  }
  return {
    _signers: { 'signer-1': signer } as Record<string, typeof signer>,
    _captures: opts?.captures as never,
    parties: {
      taxpayer: [
        {
          _role: 'taxpayer',
          id: 'taxpayer-1',
          name: opts?.name ?? 'Jane Smith',
          signatories: [signatory],
        },
      ],
    },
    signatory,
  }
}

describe('createDocxSignatureHelpers - capacity helper', () => {
  test('renders signatory.capacity when no capture exists', () => {
    const root = makeRootData({ capacity: 'President' })
    const helpers = createDocxSignatureHelpers(root)
    expect(helpers.capacity(root.signatory as never, 'sb-cap')).toBe('President')
  })

  test('renders capture.text when capture exists (priority over signatory.capacity)', () => {
    const captures = [
      {
        role: 'taxpayer',
        partyId: 'taxpayer-1',
        signerId: 'signer-1',
        locationId: 'sb-cap',
        type: 'capacity',
        text: 'Trustee',
        timestamp: '2024-06-15T14:30:00Z',
      },
    ]
    const root = makeRootData({ capacity: 'President', captures })
    const helpers = createDocxSignatureHelpers(root)
    expect(helpers.capacity(root.signatory as never, 'sb-cap')).toBe('Trustee')
  })

  test('renders default placeholder when neither capture nor signatory.capacity is set', () => {
    const root = makeRootData({ capacity: undefined })
    const helpers = createDocxSignatureHelpers(root)
    const out = helpers.capacity(root.signatory as never, 'sb-cap')
    // Default placeholder is a fixed-length underscore string
    expect(out).toMatch(/^_+$/)
  })

  test('renders custom placeholder when provided', () => {
    const root = makeRootData({ capacity: undefined })
    const helpers = createDocxSignatureHelpers(root, {
      placeholder: { capacity: '__title__' },
    })
    expect(helpers.capacity(root.signatory as never, 'sb-cap')).toBe('__title__')
  })

  test('rejects invalid arguments', () => {
    const root = makeRootData({ capacity: 'President' })
    const helpers = createDocxSignatureHelpers(root)
    expect(helpers.capacity(null as never, 'sb-cap')).toContain('Invalid capacity')
    expect(helpers.capacity(root.signatory as never, 123 as never)).toContain('Invalid capacity')
  })
})

describe('createDocxSignatureHelpers - printedName helper', () => {
  test('renders signer.person.name when no capture exists', () => {
    const root = makeRootData({ name: 'Jane Smith' })
    const helpers = createDocxSignatureHelpers(root)
    expect(helpers.printedName(root.signatory as never, 'sb-print')).toBe('Jane Smith')
  })

  test('renders capture.text when capture exists (priority over signer.person.name)', () => {
    const captures = [
      {
        role: 'taxpayer',
        partyId: 'taxpayer-1',
        signerId: 'signer-1',
        locationId: 'sb-print',
        type: 'printed_name',
        text: 'JANE A SMITH',
        timestamp: '2024-06-15T14:30:00Z',
      },
    ]
    const root = makeRootData({ name: 'Jane Smith', captures })
    const helpers = createDocxSignatureHelpers(root)
    expect(helpers.printedName(root.signatory as never, 'sb-print')).toBe('JANE A SMITH')
  })

  test('renders default placeholder when there is no signer and no capture', () => {
    // Party with no signatories
    const root = {
      _signers: {},
      _captures: undefined as never,
      parties: {
        taxpayer: [
          { _role: 'taxpayer', id: 'taxpayer-1', name: 'Anon', signatories: [] },
        ],
      },
    }
    const party = root.parties.taxpayer[0]
    const helpers = createDocxSignatureHelpers(root)
    const out = helpers.printedName(party as never, 'sb-print')
    // Default placeholder is a fixed-length underscore string
    expect(out).toMatch(/^_+$/)
  })

  test('renders custom placeholder when provided', () => {
    const root = {
      _signers: {},
      _captures: undefined as never,
      parties: {
        taxpayer: [
          { _role: 'taxpayer', id: 'taxpayer-1', name: 'Anon', signatories: [] },
        ],
      },
    }
    const party = root.parties.taxpayer[0]
    const helpers = createDocxSignatureHelpers(root, {
      placeholder: { printedName: '__name__' },
    })
    expect(helpers.printedName(party as never, 'sb-print')).toBe('__name__')
  })
})
