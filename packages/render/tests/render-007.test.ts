/**
 * render-007: extraction reads bbox members as text.
 * Input: a bbox field `area`, PDF text box bound as `area.southWest.lat`, filled through renderPdf with 12.5,
 *        then read back with extractPdfData.
 * Expected: data.fields.area.southWest.lat is the number 12.5 (as a coordinate member `spot.lat` is).
 * Actual (screened commit): the string "12.5".
 */
import type { Form } from '@paradoc/types'
import { describe, expect, it } from 'vitest'
import { extractPdfData, renderPdf } from '../src/pdf'
import { acroFormPdf } from './pdf-fixtures'

const form = {
  kind: 'form', name: 'bbox', version: '1.0.0', title: 'Bbox',
  fields: {
    area: { type: 'bbox', label: 'Area' },
    spot: { type: 'coordinate', label: 'Spot' },
  },
} as unknown as Form
const bindings = { sw_lat: 'area.southWest.lat', spot_lat: 'spot.lat' }
const data = {
  area: { southWest: { lat: 12.5, lon: 1.25 }, northEast: { lat: 13.5, lon: 2.25 } },
  spot: { lat: 40.5, lon: -70.25 },
}

describe('render-007', () => {
  it('reads a bbox member back as a number, like a coordinate member', async () => {
    const pdf = await renderPdf({ template: acroFormPdf([{ kind: 'text', name: 'sw_lat' }, { kind: 'text', name: 'spot_lat' }]), form, data, bindings })
    const result = await extractPdfData({ pdf, form, bindings })
    expect((result.data.fields as any).spot?.lat).toBe(40.5)
    expect((result.data.fields as any).area?.southWest?.lat).toBe(12.5)
  })
  it('reports a bbox member that is not a number as unparseable', async () => {
    const result = await extractPdfData({ pdf: acroFormPdf([{ kind: 'text', name: 'sw_lat', value: 'north' }, { kind: 'text', name: 'spot_lat', value: '1' }]), form, bindings })
    expect(result.report.entries.find((item) => item.path === 'area.southWest.lat')?.status).toBe('unparseable')
  })
})
