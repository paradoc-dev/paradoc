/**
 * render-008: a multiselect bound to one text field is filled but never read back.
 * Input: multiselect `hobbies` (read/run) bound to one text box `hobbies_box: 'hobbies'`, filled with ['read', 'run'].
 * Expected: extractPdfData recovers ['read', 'run'].
 * Actual (screened commit): the box holds "read, run" and the entry is `unparseable`
 *   ("A multiselect value written as one piece of text cannot be split back into its options.").
 */
import type { Form } from '@paradoc/types'
import { describe, expect, it } from 'vitest'
import { extractPdfData, renderPdf } from '../src/pdf'
import { acroFormPdf } from './pdf-fixtures'

const form = {
  kind: 'form', name: 'ms', version: '1.0.0', title: 'MS',
  fields: { hobbies: { type: 'multiselect', label: 'Hobbies', enum: [{ value: 'read', label: 'Reading' }, { value: 'run', label: 'Running' }] } },
} as unknown as Form
const bindings = { hobbies_box: 'hobbies' }

describe('render-008', () => {
  it('round-trips a multiselect written into one text box', async () => {
    const pdf = await renderPdf({ template: acroFormPdf([{ kind: 'text', name: 'hobbies_box' }]), form, data: { hobbies: ['read', 'run'] }, bindings })
    const result = await extractPdfData({ pdf, form, bindings })
    const entry = result.report.entries.find((item) => item.path === 'hobbies')
    expect(entry?.sources?.[0]?.value).toBe('read, run')
    expect(entry?.status).toBe('recovered')
    expect(result.data.fields).toEqual({ hobbies: ['read', 'run'] })
  })
  it('reports a selection with an unknown option as unparseable', async () => {
    const result = await extractPdfData({ pdf: acroFormPdf([{ kind: 'text', name: 'hobbies_box', value: 'read, swim' }]), form, bindings })
    expect(result.report.entries.find((item) => item.path === 'hobbies')?.status).toBe('unparseable')
  })
})
