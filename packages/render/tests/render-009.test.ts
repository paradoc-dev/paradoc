/**
 * render-009: enum extraction matches labels first although PDF fill writes values.
 * Input: enum `grade` with options [{ value: 'A', label: 'B' }, { value: 'B', label: 'C' }], text box bound as `grade`,
 *        filled with 'B' through renderPdf, read back with extractPdfData.
 * Expected: the box holds "B" (the value) and extraction returns 'B'.
 * Actual (screened commit): extraction matches the label "B" first and returns 'A'.
 */
import type { Form } from '@paradoc/types'
import { describe, expect, it } from 'vitest'
import { extractPdfData, renderPdf } from '../src/pdf'
import { acroFormPdf } from './pdf-fixtures'

const form = {
  kind: 'form', name: 'en', version: '1.0.0', title: 'En',
  fields: { grade: { type: 'enum', label: 'Grade', enum: [{ value: 'A', label: 'B' }, { value: 'B', label: 'C' }] } },
} as unknown as Form
const bindings = { grade_box: 'grade' }

describe('render-009', () => {
  it('round-trips an enum whose value equals another option label', async () => {
    const pdf = await renderPdf({ template: acroFormPdf([{ kind: 'text', name: 'grade_box' }]), form, data: { grade: 'B' }, bindings })
    const result = await extractPdfData({ pdf, form, bindings })
    expect(result.report.entries.find((item) => item.path === 'grade')?.sources?.[0]?.value).toBe('B')
    expect(result.data.fields).toEqual({ grade: 'B' })
  })
  it('still reads a label typed into the box when no value matches', async () => {
    const result = await extractPdfData({ pdf: acroFormPdf([{ kind: 'text', name: 'grade_box', value: 'C' }]), form, bindings })
    expect(result.data.fields).toEqual({ grade: 'B' })
  })
  it('reports text that matches no option as unparseable', async () => {
    const result = await extractPdfData({ pdf: acroFormPdf([{ kind: 'text', name: 'grade_box', value: 'Z' }]), form, bindings })
    expect(result.report.entries.find((item) => item.path === 'grade')?.status).toBe('unparseable')
  })
})
