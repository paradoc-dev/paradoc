// render-043: signing marks print in the format the layer's MIME type implies,
// and their markup prints as is inside {{ }}.
import { describe, expect, it } from 'vitest'
import { renderText } from '../src/text/render'

const tenant = { _role: 'tenant', id: 'tenant-0', name: 'Ada' }
const data = { parties: { tenant } }
const template = '{{signature(parties.tenant, "sign")}}'

describe('render-043', () => {
  it('prints an HTML mark for an HTML layer, unescaped inside {{ }}', () => {
    const output = renderText({ template, data, mimeType: 'text/html' })
    expect(output).toMatch(/^<span class="signature-placeholder" data-role="tenant"[^>]*>\[SIGNATURE\]<\/span>$/)
    expect(renderText({ template: '{{{signature(parties.tenant, "sign")}}}', data, mimeType: 'text/html' })).toBe(output)
  })

  it('prints a Markdown mark for a Markdown layer, and text for plain text', () => {
    expect(renderText({ template, data, mimeType: 'text/markdown' })).toBe('_[SIGNATURE]_')
    expect(renderText({ template, data, mimeType: 'text/plain' })).toBe('[SIGNATURE]')
    expect(renderText({ template, data })).toBe('[SIGNATURE]')
  })

  it('lets the signature options override the layer format', () => {
    expect(renderText({ template, data, mimeType: 'text/html', signatureOptions: { format: 'text' } })).toBe('[SIGNATURE]')
  })

  it('still escapes captured text an HTML layer prints', () => {
    const signed = {
      parties: { tenant: { ...tenant, signatories: [{ signerId: 'ada', capacity: '<b>Owner</b>' }] } },
      _captures: [{ role: 'tenant', partyId: 'tenant-0', signerId: 'ada', locationId: 'name', type: 'printed_name', text: '<script>x</script>', timestamp: '2026-07-12T10:30:00Z' }],
    }
    const output = renderText({ template: '{{printedName(parties.tenant, "name")}}|{{capacity(parties.tenant, "cap")}}', data: signed, mimeType: 'text/html' })
    expect(output).toBe('&lt;script&gt;x&lt;/script&gt;|&lt;b&gt;Owner&lt;/b&gt;')
  })
})
