// render-035: a Person party with no signatories signs for itself, as
// `signerId = partyId`; an Organization with none issues without a signature.
import { describe, expect, it } from 'vitest'
import { renderText } from '../src/text/render'

const capture = (partyId: string, signerId: string) => ({
  role: 'tenant', partyId, signerId, locationId: 'sign', type: 'signature', timestamp: '2026-07-12T10:30:00Z', method: 'drawn',
})
const template = '{{signature(parties.tenant, "sign")}} {{signatureDate(parties.tenant, "sign")}}'

describe('render-035', () => {
  it('shows the capture of a person party that signs for itself', () => {
    const data = {
      parties: { tenant: { _role: 'tenant', id: 'tenant-0', name: 'Ada', signatories: [] } },
      _captures: [capture('tenant-0', 'tenant-0')],
    }
    expect(renderText({ template, data })).toBe('[Signed] 2026-07-12')
  })

  it('names the party as its own signer in HTML marks', () => {
    const data = { parties: { tenant: { _role: 'tenant', id: 'tenant-0', name: 'Ada' } } }
    expect(renderText({ template: '{{signature(parties.tenant, "sign")}}', data, mimeType: 'text/html' }))
      .toContain('data-signer-id="tenant-0"')
  })

  it('reads a delegate signatory, not the party, when one is listed', () => {
    const data = {
      parties: { tenant: { _role: 'tenant', id: 'tenant-0', name: 'Ada', signatories: [{ signerId: 'agent' }] } },
      _captures: [capture('tenant-0', 'tenant-0')],
    }
    expect(renderText({ template, data })).toBe('[SIGNATURE] [DATE]')
  })

  it('does not treat an organization with no signatories as its own signer', () => {
    const data = {
      parties: { tenant: { _role: 'tenant', id: 'tenant-0', name: 'Acme', legalName: 'Acme LLC', signatories: [] } },
      _captures: [capture('tenant-0', 'tenant-0')],
    }
    expect(renderText({ template, data })).toBe('[SIGNATURE] [DATE]')
  })
})
