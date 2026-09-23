/**
 * Filling honors each AcroForm field's own appearance settings.
 *
 * Every positive claim is read back with pdf.js from the flattened output, an
 * independent reader, rather than from this package's own inspector: a comb
 * digit must land inside its box, a right-aligned amount must end at the
 * field's right edge, and a declared size must be the size drawn.
 *
 * `irs-w-9.pdf` and `irs-1099-nec-copy-a.pdf` are byte copies of the official
 * IRS forms `@paradoc/essentials` bundles for the W-9 and 1099-NEC.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { flattenPdf, inspectAcroFormFields, PdfFieldFillError, renderPdf } from '../src/pdf'
import { acroFieldsPdf, type FixtureField } from './pdf-fixtures'
import { textItemsWithPdfjs, type PdfjsTextItem } from './pdfjs-reference'

const fixtures = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures')
const load = async (name: string) => new Uint8Array(await readFile(join(fixtures, name)))

const COMB = 1 << 24
const MULTILINE = 1 << 12
const COMBO = 1 << 17
const MULTI_SELECT = 1 << 21

/** Fill by field name, flatten, and read every drawn run with pdf.js. */
async function fillAndRead(template: Uint8Array, values: Record<string, unknown>): Promise<PdfjsTextItem[]> {
  const bindings = Object.fromEntries(Object.keys(values).map((name, index) => [name, `v${index}`]))
  const data = Object.fromEntries(Object.values(values).map((value, index) => [`v${index}`, value]))
  return textItemsWithPdfjs(await flattenPdf(await renderPdf({ template, data, bindings })))
}

async function fillError(template: Uint8Array, values: Record<string, unknown>): Promise<PdfFieldFillError> {
  const bindings = Object.fromEntries(Object.keys(values).map((name, index) => [name, `v${index}`]))
  const data = Object.fromEntries(Object.values(values).map((value, index) => [`v${index}`, value]))
  const error = await renderPdf({ template, data, bindings }).then(() => undefined, (caught: unknown) => caught)
  expect(error).toBeInstanceOf(PdfFieldFillError)
  return error as PdfFieldFillError
}

const inside = (item: PdfjsTextItem, [left, bottom, right, top]: FixtureField['rect']) =>
  item.x >= left - 0.01 && item.x + item.width <= right + 0.01 && item.y >= bottom && item.y <= top

const field = (overrides: Partial<FixtureField> & Pick<FixtureField, 'name'>): FixtureField => ({
  rect: [100, 600, 300, 620],
  da: '/Helv 10 Tf 0 g',
  ...overrides,
})

describe('official forms', () => {
  const w9 = 'topmostSubform[0].Page1[0]'

  it('puts one taxpayer identification digit in each W-9 comb box at the declared size', async () => {
    const items = await fillAndRead(await load('irs-w-9.pdf'), {
      [`${w9}.f1_01[0]`]: 'Jane Q. Public',
      [`${w9}.f1_11[0]`]: '123',
      [`${w9}.f1_12[0]`]: '45',
      [`${w9}.f1_13[0]`]: '6789',
    })
    // The SSN's last group: four boxes across [518.4, 576], 14.4 points each.
    const lastGroup = items.filter((item) => item.x >= 518 && item.x <= 576 && item.y > 396 && item.y < 420)
    expect(lastGroup.map((item) => item.text)).toEqual(['6', '7', '8', '9'])
    lastGroup.forEach((item, index) => {
      const center = item.x + item.width / 2
      expect(center).toBeCloseTo(518.4 + 14.4 * (index + 0.5), 1)
      expect(item.size).toBeCloseTo(9, 3)
    })
    const name = items.find((item) => item.text === 'Jane Q. Public')!
    expect(name.size).toBeCloseTo(9, 3)
    expect(name.x).toBeCloseTo(58.6 + 2, 1)
  })

  it('centers a W-9 field whose quadding is centered', async () => {
    const items = await fillAndRead(await load('irs-w-9.pdf'), { [`${w9}.f1_05[0]`]: '5' })
    const code = items.find((item) => item.text === '5' && item.x > 543 && item.y > 588 && item.y < 600)!
    // f1_05 spans [543.6, 576].
    expect(code.x + code.width / 2).toBeCloseTo(543.6 + 32.4 / 2, 1)
  })

  it('rejects a W-9 comb value with more characters than boxes, naming the field and the box count', async () => {
    const error = await fillError(await load('irs-w-9.pdf'), { [`${w9}.f1_11[0]`]: '1234' })
    expect(error.field).toBe(`${w9}.f1_11[0]`)
    expect(error.reason).toBe('comb-length')
    expect(error.limit).toBe(3)
    expect(error.message).toContain('3 comb boxes')
  })

  it('right-aligns 1099-NEC amounts in the field color at the declared size', async () => {
    const box1 = 'topmostSubform[0].CopyA[0].RightCol[0].f1_9[0]'
    const template = await load('irs-1099-nec-copy-a.pdf')
    const rect = (await inspectAcroFormFields(template)).find((entry) => entry.name === box1)!.rect!
    const filled = await renderPdf({ template, data: { amount: '1,234.50' }, bindings: { [box1]: 'amount' } })
    expect(new TextDecoder('latin1').decode(filled)).toContain('0.000 0.000 0.502 rg')
    const amount = (await textItemsWithPdfjs(await flattenPdf(filled))).find((item) => item.text === '1,234.50')!
    expect(amount.x + amount.width).toBeCloseTo(rect[2] - 2, 1)
    expect(amount.size).toBeCloseTo(8, 3)
  })
})

describe('size', () => {
  it('sizes a value automatically to the field height when the declared size is zero', async () => {
    const [item] = await fillAndRead(acroFieldsPdf([field({ name: 'auto', da: '/Helv 0 Tf 0 g' })]), { auto: 'Hi' })
    // (20 - 2 × 1 padding) / Helvetica's 0.925 em glyph height.
    expect(item!.size).toBeCloseTo(18 / 0.925, 2)
  })

  it('uses the AcroForm default appearance when the field declares none', async () => {
    const template = acroFieldsPdf([field({ name: 'plain', da: undefined })], { da: '/Helv 7 Tf 0 g' })
    const [item] = await fillAndRead(template, { plain: 'Hi' })
    expect(item!.size).toBeCloseTo(7, 3)
  })

  it('shrinks a value that is too wide for its declared size, and keeps it inside the field', async () => {
    const rect: FixtureField['rect'] = [100, 600, 200, 620]
    const text = 'Wider than ninety-six points'
    const [item] = await fillAndRead(acroFieldsPdf([field({ name: 'wide', rect, da: '/Helv 12 Tf 0 g' })]), { wide: text })
    expect(item!.text).toBe(text)
    expect(item!.size).toBeLessThan(12)
    expect(item!.size).toBeGreaterThanOrEqual(6)
    expect(inside(item!, rect)).toBe(true)
  })

  it('fails with an overflow error naming the field when the value cannot fit at the minimum size', async () => {
    const template = acroFieldsPdf([field({ name: 'narrow', rect: [100, 600, 140, 620] })])
    const error = await fillError(template, { narrow: 'Far too long for a forty point box' })
    expect(error.field).toBe('narrow')
    expect(error.reason).toBe('overflow')
    expect(error.limit).toBe(6)
  })

  it('fails with an overflow error for an automatically sized value that cannot fit', async () => {
    const template = acroFieldsPdf([field({ name: 'auto', rect: [100, 600, 140, 620], da: '/Helv 0 Tf 0 g' })])
    expect((await fillError(template, { auto: 'Far too long for a forty point box' })).reason).toBe('overflow')
  })
})

describe('alignment', () => {
  it.each([
    [0, (item: PdfjsTextItem) => item.x, 102],
    [1, (item: PdfjsTextItem) => item.x + item.width / 2, 200],
    [2, (item: PdfjsTextItem) => item.x + item.width, 298],
  ])('places quadding %i by the field edge or center', async (q, anchor, expected) => {
    const [item] = await fillAndRead(acroFieldsPdf([field({ name: 'aligned', q })]), { aligned: 'Total' })
    expect(anchor(item!)).toBeCloseTo(expected, 1)
  })
})

describe('comb', () => {
  it('spreads a shorter value from the first box', async () => {
    const template = acroFieldsPdf([field({ name: 'zip', rect: [100, 600, 280, 620], flags: COMB, maxLen: 9 })])
    const items = await fillAndRead(template, { zip: '62704' })
    expect(items.map((item) => item.text)).toEqual(['6', '2', '7', '0', '4'])
    items.forEach((item, index) => expect(item.x + item.width / 2).toBeCloseTo(100 + 20 * (index + 0.5), 1))
  })

  it('accepts a value exactly as long as the box count and rejects one character more', async () => {
    const template = acroFieldsPdf([field({ name: 'code', rect: [100, 600, 160, 620], flags: COMB, maxLen: 3 })])
    expect((await fillAndRead(template, { code: 'ABC' })).map((item) => item.text)).toEqual(['A', 'B', 'C'])
    const error = await fillError(template, { code: 'ABCD' })
    expect([error.field, error.reason, error.limit]).toEqual(['code', 'comb-length', 3])
  })
})

describe('multiline', () => {
  const rect: FixtureField['rect'] = [100, 500, 220, 560]

  it('wraps text within the field, line under line', async () => {
    const template = acroFieldsPdf([field({ name: 'address', rect, flags: MULTILINE })])
    const items = await fillAndRead(template, { address: '1 Main Street, Suite 400, Springfield, Illinois 62704' })
    expect(items.length).toBeGreaterThan(1)
    expect(items.map((item) => item.text).join(' ')).toBe('1 Main Street, Suite 400, Springfield, Illinois 62704')
    items.forEach((item) => expect(inside(item, rect)).toBe(true))
    for (let index = 1; index < items.length; index++) expect(items[index]!.y).toBeLessThan(items[index - 1]!.y)
  })

  it('keeps explicit line breaks', async () => {
    const template = acroFieldsPdf([field({ name: 'address', rect, flags: MULTILINE })])
    const items = await fillAndRead(template, { address: 'Acme\nSpringfield' })
    expect(items.map((item) => item.text)).toEqual(['Acme', 'Springfield'])
  })

  it('shrinks when the wrapped text is too tall at the declared size', async () => {
    const template = acroFieldsPdf([field({ name: 'notes', rect, flags: MULTILINE, da: '/Helv 12 Tf 0 g' })])
    const items = await fillAndRead(template, { notes: 'one two three four five six seven eight nine ten eleven twelve thirteen '.repeat(2).trim() })
    expect(items[0]!.size).toBeLessThan(12)
    items.forEach((item) => expect(inside(item, rect)).toBe(true))
  })

  it('fails with an overflow error when the text cannot fit at the minimum size', async () => {
    const template = acroFieldsPdf([field({ name: 'notes', rect, flags: MULTILINE })])
    const error = await fillError(template, { notes: 'word '.repeat(200) })
    expect([error.field, error.reason, error.limit]).toEqual(['notes', 'overflow', 6])
  })
})

describe('choice', () => {
  const options: Array<[string, string]> = [['red', 'Red'], ['green', 'Green'], ['blue', 'Blue']]

  it('shows every selected value of a multi-select list and records the selection', async () => {
    const template = acroFieldsPdf([field({
      name: 'colors', type: 'Ch', rect: [100, 500, 220, 560], flags: MULTI_SELECT, options,
    })])
    const filled = await renderPdf({ template, data: { colors: ['blue', 'red'] }, bindings: { colors: 'colors' } })
    expect((await inspectAcroFormFields(filled))[0]?.value).toEqual(['blue', 'red'])
    expect(new TextDecoder('latin1').decode(filled)).toMatch(/\/I \[0 2\]/)
    const items = await textItemsWithPdfjs(await flattenPdf(filled))
    expect(items.map((item) => item.text)).toEqual(['Blue', 'Red'])
  })

  it('shows a combo box value by its display text', async () => {
    const template = acroFieldsPdf([field({ name: 'color', type: 'Ch', flags: COMBO, options })])
    const items = await fillAndRead(template, { color: 'green' })
    expect(items.map((item) => item.text)).toEqual(['Green'])
  })
})

describe('flattening and hashing', () => {
  it('fills and flattens byte-identically on repeat, leaving no interactive form', async () => {
    const template = acroFieldsPdf([
      field({ name: 'name' }),
      field({ name: 'tin', rect: [100, 560, 190, 580], flags: COMB, maxLen: 9 }),
    ])
    const fill = () => renderPdf({ template, data: { name: 'Jane', tin: '123456789' }, bindings: { name: 'name', tin: 'tin' } })
    const [first, second] = [await fill(), await fill()]
    expect(second).toEqual(first)
    const flat = await flattenPdf(first)
    expect(await flattenPdf(second)).toEqual(flat)
    expect(await inspectAcroFormFields(flat)).toEqual([])
  })
})
