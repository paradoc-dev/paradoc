/**
 * The authoring check finds bindings whose values cannot fill their PDF text
 * fields, measuring with the same layout code filling uses.
 *
 * Each overflow the check reports is confirmed by filling: the widest value it
 * names fails with the same reason, and a value it passes fills.
 */

import { describe, expect, it } from 'vitest'
import type { Form, FormField } from '@paradoc/types'
import { checkPdfBindingFit, PdfFieldFillError, renderPdf, TYPICAL_TEXT } from '../src/pdf'
import { analyzePattern } from '../src/pdf/pattern-bounds'
import { syntheticFont } from './font-fixtures'
import { acroFieldsPdf, pagePdf, type FixtureField } from './pdf-fixtures'

const COMB = 1 << 24
const MULTILINE = 1 << 12

/** The first `length` characters of the repeated typical text. */
const typical = (length: number) => TYPICAL_TEXT.repeat(Math.ceil(length / TYPICAL_TEXT.length)).slice(0, length)

const formOf = (fields: Record<string, FormField>): Form =>
  ({ kind: 'form', name: 'fit', version: '1.0.0', title: 'Fit', fields }) as Form

/** A text field `name` whose box is `width` × `height` points, at the origin of a page. */
const box = (name: string, width: number, height: number, extra: Partial<FixtureField> = {}): FixtureField =>
  ({ name, rect: [20, 20, 20 + width, 20 + height], ...extra })

async function check(fields: FixtureField[], form: Form, bindings?: Record<string, string>, layerFont?: Uint8Array) {
  return checkPdfBindingFit({
    template: acroFieldsPdf(fields),
    form,
    ...(bindings && { bindings }),
    ...(layerFont && { layerFont: { bytes: layerFont, source: 'layer.ttf' } }),
  })
}

async function fillFails(fields: FixtureField[], form: Form, bindings: Record<string, string>, data: Record<string, unknown>) {
  const error = await renderPdf({ template: acroFieldsPdf(fields), form, data, bindings }).then(() => undefined, (caught: unknown) => caught)
  return error instanceof PdfFieldFillError ? error.reason : undefined
}

describe('checkPdfBindingFit', () => {
  it('passes a bounded text field whose widest value fits its box', async () => {
    const form = formOf({ name: { type: 'text', maxLength: 10 } })
    expect(await check([box('name', 200, 14)], form, { name: 'name' })).toEqual([])
  })

  it('reports a maxLength whose typical value cannot fit the box at the minimum size, as filling does', async () => {
    const fields = [box('amountSource', 48, 12)]
    const form = formOf({ amountSource: { type: 'text', maxLength: 200 } })
    const issues = await check(fields, form, { amountSource: 'amountSource' })
    expect(issues).toEqual([expect.objectContaining({
      field: 'amountSource',
      paths: ['fields.amountSource'],
      severity: 'error',
      reason: 'overflow',
      value: 'typical',
      limit: 6,
      length: 200,
    })])
    expect(issues[0]!.message).toContain('the typical value fields.amountSource accepts under maxLength 200')
    expect(issues[0]!.message).toContain('48 × 12 pt box')
    expect(await fillFails(fields, form, { amountSource: 'amountSource' }, { amountSource: typical(200) })).toBe('overflow')
  })

  it('warns when a typical value fits but the widest value, all W, does not', async () => {
    // Ten typical characters fit a 40 pt box at 6 pt in Helvetica; ten of `W` do not.
    const fields = [box('code', 40, 12)]
    const form = formOf({ code: { type: 'text', maxLength: 10 } })
    const issues = await check(fields, form, { code: 'code' })
    expect(issues).toEqual([expect.objectContaining({ severity: 'warning', reason: 'overflow', value: 'widest', length: 10 })])
    expect(issues[0]!.message).toContain('"WWWWWWWWWW"')
    expect(await fillFails(fields, form, { code: 'code' }, { code: typical(10) })).toBeUndefined()
    expect(await fillFails(fields, form, { code: 'code' }, { code: 'W'.repeat(10) })).toBe('overflow')
  })

  it('measures a pattern with the characters it allows', async () => {
    const form = formOf({ code: { type: 'text', maxLength: 10, pattern: '^\\d{10}$' } })
    expect(await check([box('code', 40, 12)], form, { code: 'code' })).toEqual([])
  })

  it('measures with the font the layer declares', async () => {
    // Every glyph of the synthetic font is 600 units wide; Helvetica's W is 944.
    const font = syntheticFont({ name: 'Narrow', characters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' })
    const fields = [box('code', 50, 12)]
    const form = formOf({ code: { type: 'text', maxLength: 10 } })
    expect(await check(fields, form, { code: 'code' })).toEqual([expect.objectContaining({ severity: 'warning', value: 'widest' })])
    expect(await check(fields, form, { code: 'code' }, font)).toEqual([])
  })

  it('passes a maxLength whose typical and widest values both fit', async () => {
    const form = formOf({ code: { type: 'text', maxLength: 6 } })
    expect(await check([box('code', 40, 12)], form, { code: 'code' })).toEqual([])
  })

  it('reports a comb field with fewer boxes than a pattern allows characters', async () => {
    const fields = [box('ssn', 180, 14, { flags: COMB, maxLen: 9 })]
    const form = formOf({ ssn: { type: 'text', pattern: '^\\d{3}-\\d{2}-\\d{4}$' } })
    const issues = await check(fields, form, { ssn: 'ssn' })
    expect(issues).toEqual([expect.objectContaining({ severity: 'error', reason: 'comb-length', limit: 9, length: 11 })])
    expect(issues[0]!.message).toContain('9 comb boxes')
    expect(await fillFails(fields, form, { ssn: 'ssn' }, { ssn: '123-45-6789' })).toBe('comb-length')
  })

  it('passes a comb field whose boxes hold every character the pattern allows', async () => {
    const form = formOf({ ssn: { type: 'text', pattern: '^\\d{9}$' } })
    expect(await check([box('ssn', 180, 14, { flags: COMB, maxLen: 9 })], form, { ssn: 'ssn' })).toEqual([])
  })

  it('checks a split binding against the matching part of the pattern', async () => {
    const fields = [box('ssnArea', 60, 14, { flags: COMB, maxLen: 3 }), box('ssnSerial', 60, 14, { flags: COMB, maxLen: 3 })]
    const form = formOf({ ssn: { type: 'text', pattern: '^\\d{3}-\\d{2}-\\d{4}$' } })
    const issues = await check(fields, form, { ssnArea: 'ssn:1', ssnSerial: 'ssn:3' })
    expect(issues).toEqual([expect.objectContaining({ field: 'ssnSerial', reason: 'comb-length', limit: 3, length: 4 })])
    expect(issues[0]!.message).toContain('(part 3)')
    expect(await fillFails(fields, form, { ssnSerial: 'ssn:3' }, { ssn: '123-45-6789' })).toBe('comb-length')
  })

  it('bounds a split part by the whole maxLength when the pattern does not fix the parts', async () => {
    const fields = [box('part', 60, 14, { flags: COMB, maxLen: 3 })]
    const form = formOf({ ref: { type: 'text', maxLength: 7 } })
    expect(await check(fields, form, { part: 'ref:1' })).toEqual([expect.objectContaining({ reason: 'comb-length', length: 7 })])
  })

  it('reports an enum option value too wide for its box', async () => {
    const fields = [box('status', 30, 12)]
    const form = formOf({ status: { type: 'enum', enum: [{ value: 'A' }, { value: 'WITHDRAWN_BY_APPLICANT' }] } })
    const issues = await check(fields, form, { status: 'status' })
    expect(issues).toEqual([expect.objectContaining({ reason: 'overflow', severity: 'error' })])
    expect(issues[0]!.message).toContain('the longest value fields.status accepts under its widest option value')
    expect(issues[0]!.message).toContain('WITHDRAWN_BY_APPLICANT')
    expect(await fillFails(fields, form, { status: 'status' }, { status: 'WITHDRAWN_BY_APPLICANT' })).toBe('overflow')
  })

  it('passes enum option values that fit, and ignores a qualified binding that fills a checkbox', async () => {
    const form = formOf({ status: { type: 'enum', enum: [{ value: 'A' }, { value: 'B' }] } })
    expect(await check([box('status', 30, 12), box('statusA', 4, 4)], form, { status: 'status', statusA: 'status:A' })).toEqual([])
  })

  it('checks a multiselect by its widest allowed selection', async () => {
    const values = [{ value: 'alpha' }, { value: 'bravo' }, { value: 'charlie' }]
    const fields = [box('picks', 40, 12)]
    expect(await check(fields, formOf({ picks: { type: 'multiselect', enum: values, max: 1 } }), { picks: 'picks' })).toEqual([])
    expect(await check(fields, formOf({ picks: { type: 'multiselect', enum: values } }), { picks: 'picks' }))
      .toEqual([expect.objectContaining({ reason: 'overflow' })])
  })

  it('lets a multiline field wrap the widest value over its lines', async () => {
    const form = formOf({ notes: { type: 'text', maxLength: 200 } })
    expect(await check([box('notes', 200, 100, { flags: MULTILINE })], form, { notes: 'notes' })).toEqual([])
    expect(await check([box('notes', 200, 14)], form, { notes: 'notes' })).toEqual([expect.objectContaining({ severity: 'error', reason: 'overflow' })])
  })

  it('warns about a text field with nothing bounding its length', async () => {
    const issues = await check([box('memo', 100, 12)], formOf({ memo: { type: 'text' } }), { memo: 'memo' })
    expect(issues).toEqual([expect.objectContaining({ severity: 'warning', reason: 'unbounded', paths: ['fields.memo'] })])
  })

  it('checks a joined binding when every part is bounded', async () => {
    const form = formOf({ city: { type: 'text', maxLength: 20 }, state: { type: 'text', maxLength: 2 } })
    expect(await check([box('place', 300, 14)], form, { place: 'city, state' })).toEqual([])
    expect(await check([box('place', 60, 12)], form, { place: 'city, state' }))
      .toEqual([expect.objectContaining({ reason: 'overflow', paths: ['fields.city', 'fields.state'] })])
  })

  it('fills same-named fields when the layer declares no bindings', async () => {
    expect(await check([box('amountSource', 48, 12)], formOf({ amountSource: { type: 'text', maxLength: 200 } })))
      .toEqual([expect.objectContaining({ field: 'amountSource', reason: 'overflow' })])
  })

  it('has nothing to check in a PDF without an AcroForm', async () => {
    expect(await checkPdfBindingFit({ template: pagePdf([[612, 792]]), form: formOf({ a: { type: 'text', maxLength: 500 } }) })).toEqual([])
  })
})

describe('analyzePattern', () => {
  const length = (text: string) => text.length
  const first = () => 'x'

  it('bounds lengths through classes, groups, alternation, and quantifiers', () => {
    expect(analyzePattern('^\\d{3}-\\d{2}-\\d{4}$')!.shape(length, first).maxLength).toBe(11)
    expect(analyzePattern('^(?:[A-Z]{2}|\\d{5})(-\\d{4})?$')!.shape(length, first).maxLength).toBe(10)
    expect(analyzePattern('^[^@]+@example\\.com$')!.shape(length, first).maxLength).toBe(Infinity)
  })

  it('splits a pattern on fixed hyphens, and declines when a hyphen can fall anywhere', () => {
    expect(analyzePattern('^\\d{3}-\\d{2}-\\d{4}$')!.part(2, length, first)!.maxLength).toBe(4)
    expect(analyzePattern('^[A-Z]{2}-\\d{3}$')!.part(1, length, (set) => set.any ? '?' : set.chars[0]!)!.value).toBe('000')
    expect(analyzePattern('^[\\d-]{11}$')!.part(0, length, first)).toBeUndefined()
  })

  it('leaves a pattern outside the supported subset unanalyzed', () => {
    expect(analyzePattern('^(a)\\1$')).toBeUndefined()
  })
})
