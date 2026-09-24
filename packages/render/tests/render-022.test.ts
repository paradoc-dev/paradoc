// render-022: a signing directive's location is checked once, by the template
// pipeline, before any directive runs.
import { describe, expect, it } from 'vitest'
import { renderText } from '../src/text/render'
import { TemplateError } from '../src/template/errors'

const party = { parties: { tenant: { _role: 'tenant', id: 'tenant-0', name: 'Ada' } } }

describe('render-022', () => {
  it('rejects a location that is not a string', () => {
    expect(() => renderText({ template: '{{signature(parties.tenant, 1)}}', data: party }))
      .toThrow(TemplateError)
    expect(() => renderText({ template: '{{signature(parties.tenant, 1)}}', data: party }))
      .toThrow(/location must be a string/)
  })

  it('renders a string location', () => {
    expect(renderText({ template: '{{signature(parties.tenant, "sign")}}', data: party })).toBe('[SIGNATURE]')
  })
})
