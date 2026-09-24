import { describe, it, expect } from 'vitest'
import { validateFormData, type Form } from '@paradoc/core'
import { makeInstanceTemplate } from '../../src/utils/instance-template.js'
import { validateFormPayload, type PayloadValidationResult } from '../../src/utils/validate-data.js'

const errorsOf = (result: PayloadValidationResult) => (result.success ? [] : result.errors)

const form = {
  kind: 'form',
  name: 'composite-probe',
  version: '1.0.0',
  title: 'Composite probe',
  fields: {
    loc: { type: 'coordinate', label: 'Location' },
    area: { type: 'bbox', label: 'Area' },
    price: { type: 'money', label: 'Price' },
    addr: { type: 'address', label: 'Address' },
    tel: { type: 'phone', label: 'Phone' },
    who: { type: 'person', label: 'Person' },
    org: { type: 'organization', label: 'Organization' },
    doc: { type: 'identification', label: 'ID' },
    group: {
      type: 'fieldset',
      label: 'Group',
      fields: { inner: { type: 'coordinate', label: 'Inner' } },
    },
  },
} as unknown as Form

describe('makeInstanceTemplate composite defaults', () => {
  it('emits the canonical primitive shapes', () => {
    const { fields } = makeInstanceTemplate(form)
    expect(fields.loc).toEqual({ lat: 0, lon: 0 })
    expect(fields.area).toEqual({ southWest: { lat: 0, lon: 0 }, northEast: { lat: 0, lon: 0 } })
    expect(fields.addr).toEqual({ line1: '', locality: '', region: '', postalCode: '', country: '' })
    expect(fields.who).toEqual({ name: '' })
    expect(fields.group).toEqual({ inner: { lat: 0, lon: 0 } })
  })

  it('produces a template whose shapes the core schema validator accepts', () => {
    const template = makeInstanceTemplate(form)
    // The only core complaint is the empty phone placeholder, which must be filled in E.164.
    const errors = validateFormData(form, template as unknown as Record<string, unknown>).errors ?? []
    expect(errors.map((error) => error.field)).toEqual(['fields.tel.number'])
    expect(validateFormPayload(form, { fields: { ...template.fields, tel: { number: '+12154852665' } } })).toMatchObject({ success: true })
  })
})

describe('validateFormPayload composite shapes', () => {
  it('rejects a coordinate that uses lng instead of lon', () => {
    const result = validateFormPayload(form, { fields: { loc: { lat: 0, lng: 0 } } })
    expect(result.success).toBe(false)
    expect(errorsOf(result).map((error) => error.field)).toEqual(['fields.loc.lon', 'fields.loc'])
    expect(errorsOf(result)[1]?.message).toContain('lng')
  })

  it('rejects a bbox with flat north/south/east/west keys', () => {
    const result = validateFormPayload(form, { fields: { area: { north: 0, south: 0, east: 0, west: 0 } } })
    expect(result.success).toBe(false)
    expect(errorsOf(result).map((error) => error.field)).toEqual(
      expect.arrayContaining(['fields.area.southWest', 'fields.area.northEast']),
    )
  })

  it('rejects an address with street/city/state keys', () => {
    const result = validateFormPayload(form, {
      fields: { addr: { street: '', city: '', state: '', postalCode: '', country: '' } },
    })
    expect(result.success).toBe(false)
    expect(errorsOf(result).map((error) => error.field)).toEqual(
      expect.arrayContaining(['fields.addr.line1', 'fields.addr.locality', 'fields.addr.region']),
    )
  })

  it('rejects a person without the required name', () => {
    const result = validateFormPayload(form, { fields: { who: { firstName: 'Ada', lastName: 'Lovelace' } } })
    expect(result.success).toBe(false)
    expect(errorsOf(result).map((error) => error.field)).toContain('fields.who.name')
  })

  it('rejects a wrong shape nested in a fieldset', () => {
    const result = validateFormPayload(form, { fields: { group: { inner: { lat: 1, lng: 2 } } } })
    expect(result.success).toBe(false)
    expect(errorsOf(result).map((error) => error.field)).toContain('fields.group.inner.lon')
  })

  it('rejects a non-object composite value', () => {
    const result = validateFormPayload(form, { fields: { price: [100, 'USD'] } })
    expect(result.success).toBe(false)
    expect(errorsOf(result)[0]?.field).toBe('fields.price')
  })

  it('accepts filled canonical shapes', () => {
    const result = validateFormPayload(form, {
      fields: {
        loc: { lat: 40.7, lon: -74 },
        area: { southWest: { lat: 40, lon: -75 }, northEast: { lat: 41, lon: -73 } },
        price: { amount: 100.5, currency: 'USD' },
        addr: { line1: '1 Main St', locality: 'Springfield', region: 'IL', postalCode: '62701', country: 'US' },
        tel: { number: '+12154852665' },
        who: { name: 'Ada Lovelace', firstName: 'Ada', lastName: 'Lovelace' },
        org: { name: 'Acme' },
        doc: { type: 'passport', number: 'X123' },
        group: { inner: { lat: 1, lon: 2 } },
      },
    })
    expect(result).toMatchObject({ success: true })
  })
})

describe('validateFormPayload annex values', () => {
  const annexForm = {
    kind: 'form',
    name: 'annex-probe',
    version: '1.0.0',
    title: 'Annex probe',
    fields: { note: { type: 'text', label: 'Note' } },
    annexes: {
      proof: { title: 'Proof', required: true },
      extra: { title: 'Extra' },
    },
  } as unknown as Form

  it('accepts an Attachment and leaves an optional annex out', () => {
    const result = validateFormPayload(annexForm, {
      fields: {},
      annexes: { proof: { name: 'proof.pdf', mimeType: 'application/pdf' } },
    })
    expect(result).toEqual({
      success: true,
      data: { fields: {}, annexes: { proof: { name: 'proof.pdf', mimeType: 'application/pdf' } } },
    })
  })

  it('rejects a missing required annex and a null annex, as the SDK does', () => {
    const result = validateFormPayload(annexForm, { fields: {}, annexes: { extra: null } })
    expect(result.success).toBe(false)
    expect(errorsOf(result).map((error) => error.field)).toEqual(['annexes.extra'])
    const missing = validateFormPayload(annexForm, { fields: {} })
    expect(missing.success).toBe(false)
    expect(errorsOf(missing).map((error) => error.field)).toEqual(['annexes.proof'])
  })

  it('rejects an annex value that is not an Attachment, naming the annex', () => {
    const result = validateFormPayload(annexForm, {
      fields: {},
      annexes: { proof: { filename: 'proof.pdf' } },
    })
    expect(result.success).toBe(false)
    expect(errorsOf(result).length).toBeGreaterThan(0)
    for (const error of errorsOf(result)) expect(error.field.startsWith('annexes.proof')).toBe(true)
  })
})
