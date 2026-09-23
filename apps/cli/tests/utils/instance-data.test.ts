import { describe, it, expect } from 'vitest'
import { validateFormData, type Form } from '@paradoc/core'
import { makeInstanceTemplate } from '../../src/utils/instance-template.js'
import { validateInstanceData } from '../../src/utils/validate-data.js'

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
    expect(validateInstanceData(form, { fields: { ...template.fields, tel: { number: '+12154852665' } } })).toMatchObject({
      success: true,
      errors: [],
    })
  })
})

describe('validateInstanceData composite shapes', () => {
  it('rejects a coordinate that uses lng instead of lon', () => {
    const result = validateInstanceData(form, { fields: { loc: { lat: 0, lng: 0 } } })
    expect(result.success).toBe(false)
    expect(result.errors.map((error) => error.field)).toEqual(['fields.loc.lon', 'fields.loc'])
    expect(result.errors[1]?.message).toContain('lng')
  })

  it('rejects a bbox with flat north/south/east/west keys', () => {
    const result = validateInstanceData(form, { fields: { area: { north: 0, south: 0, east: 0, west: 0 } } })
    expect(result.success).toBe(false)
    expect(result.errors.map((error) => error.field)).toEqual(
      expect.arrayContaining(['fields.area.southWest', 'fields.area.northEast']),
    )
  })

  it('rejects an address with street/city/state keys', () => {
    const result = validateInstanceData(form, {
      fields: { addr: { street: '', city: '', state: '', postalCode: '', country: '' } },
    })
    expect(result.success).toBe(false)
    expect(result.errors.map((error) => error.field)).toEqual(
      expect.arrayContaining(['fields.addr.line1', 'fields.addr.locality', 'fields.addr.region']),
    )
  })

  it('rejects a person without the required name', () => {
    const result = validateInstanceData(form, { fields: { who: { firstName: 'Ada', lastName: 'Lovelace' } } })
    expect(result.success).toBe(false)
    expect(result.errors.map((error) => error.field)).toContain('fields.who.name')
  })

  it('rejects a wrong shape nested in a fieldset', () => {
    const result = validateInstanceData(form, { fields: { group: { inner: { lat: 1, lng: 2 } } } })
    expect(result.success).toBe(false)
    expect(result.errors.map((error) => error.field)).toContain('fields.group.inner.lon')
  })

  it('rejects a non-object composite value', () => {
    const result = validateInstanceData(form, { fields: { price: [100, 'USD'] } })
    expect(result.success).toBe(false)
    expect(result.errors[0]?.field).toBe('fields.price')
  })

  it('accepts filled canonical shapes', () => {
    const result = validateInstanceData(form, {
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
    expect(result).toMatchObject({ success: true, errors: [] })
  })
})
