/**
 * Font selection for PDF filling and overlays.
 *
 * Each value is drawn in the first font that can draw all of it: a render-time
 * font, then the layer's declared font, then the form's own embedded font for
 * the field, then Helvetica for WinAnsi text. Drawn characters and embedded
 * fonts are read back with pdf.js from the flattened output, not from this
 * package's own inspector.
 */

import { describe, expect, it } from 'vitest'
import {
  flattenPdf,
  inspectAcroFormFields,
  PdfFieldFillError,
  PdfFontError,
  renderPdf,
  type PdfFont,
  type RenderPdfOptions,
} from '../src/pdf'
import { liberationSans, syntheticFont } from './font-fixtures'
import { acroFieldsPdf, pagePdf, type FixtureField, type FixtureForm } from './pdf-fixtures'
import { fieldValuesWithPdfjs, fontsWithPdfjs, textItemsWithPdfjs } from './pdfjs-reference'

const COMB = 1 << 24

const liberation: PdfFont = { bytes: liberationSans(), source: 'fonts/LiberationSans-Regular.ttf' }
const cjk: PdfFont = {
  bytes: syntheticFont({ name: 'ParadocTestCJK', characters: '中文字漢𠀋 ' }),
  source: 'fonts/test-cjk.ttf',
}
const cyrillicOnly = syntheticFont({ name: 'ParadocTestFormFont', characters: 'Жук ' })

const field = (overrides: Partial<FixtureField> = {}): FixtureField => ({
  name: 'name',
  rect: [100, 600, 400, 620],
  da: '/Helv 10 Tf 0 g',
  ...overrides,
})

/** Fill one field, flatten, and read back the drawn text and the fonts pdf.js loaded. */
async function fill(
  value: unknown,
  options: Pick<RenderPdfOptions, 'font' | 'layerFont'> = {},
  fixture: { field?: Partial<FixtureField>; form?: FixtureForm } = {},
) {
  const template = acroFieldsPdf([field(fixture.field)], fixture.form)
  const filled = await renderPdf({ template, data: { value }, bindings: { name: 'value' }, ...options })
  const flat = await flattenPdf(filled)
  return {
    filled,
    text: (await textItemsWithPdfjs(flat)).map((item) => item.text).join(''),
    fonts: await fontsWithPdfjs(flat),
  }
}

async function fillError<T extends Error>(
  kind: new (...args: never[]) => T,
  value: unknown,
  options: Pick<RenderPdfOptions, 'font' | 'layerFont'> = {},
  form?: FixtureForm,
): Promise<T> {
  const template = acroFieldsPdf([field()], form)
  const error = await renderPdf({ template, data: { value }, bindings: { name: 'value' }, ...options })
    .then(() => undefined, (caught: unknown) => caught)
  expect(error).toBeInstanceOf(kind)
  return error as T
}

describe('declared fonts', () => {
  it.each([
    ['Latin Extended', 'Łódź Żółć Ștefan Győr'],
    ['Greek', 'Ωμέγα Αθήνα'],
    ['Cyrillic', 'Жуковский Москва'],
  ])('fills %s text with the layer font, embedded in the output', async (_script, value) => {
    const result = await fill(value, { layerFont: liberation })
    expect(result.text).toBe(value)
    expect(result.fonts).toEqual([{ name: 'LiberationSans', missingFile: false }])
  })

  it('fills CJK text, including a character outside the Basic Multilingual Plane', async () => {
    const value = '中文字漢𠀋'
    const result = await fill(value, { layerFont: cjk })
    expect(result.text).toBe(value)
    expect(result.fonts).toEqual([{ name: 'ParadocTestCJK', missingFile: false }])
    expect(await fieldValuesWithPdfjs(result.filled)).toEqual({ name: value })
  })

  it('lays comb boxes out with the chosen font\'s own advance widths', async () => {
    const template = acroFieldsPdf([field({ rect: [100, 600, 220, 620], flags: COMB, maxLen: 4 })])
    const filled = await renderPdf({ template, data: { value: '中文' }, bindings: { name: 'value' }, layerFont: cjk })
    const items = await textItemsWithPdfjs(await flattenPdf(filled))
    expect(items.map((item) => item.text)).toEqual(['中', '文'])
    // The synthetic font advances 600/1000 em, so a 10 pt glyph is 6 pt wide.
    items.forEach((item, index) => expect(item.x + 3).toBeCloseTo(100 + 30 * (index + 0.5), 1))
  })
})

describe('font order', () => {
  const override: PdfFont = {
    bytes: syntheticFont({ name: 'ParadocTestOverride', characters: 'Жук ' }),
    source: 'override.ttf',
  }

  it('prefers the render-time font to the layer font', async () => {
    const result = await fill('Жук', { font: override, layerFont: liberation })
    expect(result.fonts.map((font) => font.name)).toEqual(['ParadocTestOverride'])
  })

  it('falls through to the layer font for a value the render-time font cannot draw', async () => {
    const result = await fill('Ωμέγα', { font: override, layerFont: liberation })
    expect(result.text).toBe('Ωμέγα')
    expect(result.fonts.map((font) => font.name)).toEqual(['LiberationSans'])
  })

  it('prefers the layer font to the form\'s own font', async () => {
    const result = await fill('Жук', { layerFont: liberation }, {
      field: { da: '/FormFont 10 Tf 0 g' },
      form: { fonts: { FormFont: cyrillicOnly } },
    })
    expect(result.fonts.map((font) => font.name)).toEqual(['LiberationSans'])
  })
})

describe('the form\'s own font', () => {
  const form: FixtureForm = { fonts: { FormFont: cyrillicOnly } }
  const ownFont = { field: { da: '/FormFont 10 Tf 0 g' }, form }

  it('draws a value it covers with no font configured, embedded from the form', async () => {
    const result = await fill('Жук', {}, ownFont)
    expect(result.text).toBe('Жук')
    expect(result.fonts).toEqual([{ name: 'ParadocTestFormFont', missingFile: false }])
  })

  it('falls through to Helvetica for a Latin-1 value it does not cover', async () => {
    const result = await fill('Café', {}, ownFont)
    expect(result.text).toBe('Café')
    expect(result.fonts.map((font) => font.name)).toEqual(['Helvetica'])
  })

  it('is only a candidate for the field whose appearance names it', async () => {
    const error = await fillError(PdfFieldFillError, 'Жук', {}, form)
    expect(error.reason).toBe('missing-glyph')
  })
})

describe('Helvetica and missing glyphs', () => {
  it('fills Latin-1 text in Helvetica when no other font applies', async () => {
    const result = await fill('Crème brûlée')
    expect(result.text).toBe('Crème brûlée')
    expect(result.fonts.map((font) => font.name)).toEqual(['Helvetica'])
    expect(new TextDecoder('latin1').decode(result.filled)).not.toContain('/FontFile2')
  })

  it('fails naming the field and the character when no font can draw it', async () => {
    const error = await fillError(PdfFieldFillError, 'Жук')
    expect([error.field, error.reason, error.character]).toEqual(['name', 'missing-glyph', 'Ж'])
    expect(error.message).toContain('U+0416')
    expect(error.message).toContain('Declare a font')
  })

  it('never draws a mapped glyph that has no outline', async () => {
    const hollow: PdfFont = { bytes: syntheticFont({ name: 'ParadocTestHollow', characters: '中', blank: '空' }), source: 'hollow.ttf' }
    expect(await fill('中', { layerFont: hollow }).then((result) => result.text)).toBe('中')
    const error = await fillError(PdfFieldFillError, '中空', { layerFont: hollow })
    expect([error.reason, error.character]).toEqual(['missing-glyph', '空'])
  })
})

describe('scripts that need shaping', () => {
  it.each([
    ['Arabic', 'مرحبا'],
    ['Hebrew', 'שלום'],
    ['Devanagari', 'नमस्ते'],
    ['Thai', 'สวัสดี'],
  ])('rejects %s naming the field and the script, even with a font that covers it', async (script, value) => {
    const covering: PdfFont = { bytes: syntheticFont({ name: 'ParadocTestCovering', characters: value }), source: 'covering.ttf' }
    const error = await fillError(PdfFieldFillError, value, { layerFont: covering })
    expect([error.field, error.reason, error.script]).toEqual(['name', 'unsupported-script', script])
    expect(error.message).toContain('React composition')
  })
})

describe('font sources', () => {
  it.each([
    ['unreadable', new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])],
    ['unsupported-format', syntheticFont({ name: 'Cff', characters: 'a', signature: 'OTTO' })],
    ['not-embeddable', syntheticFont({ name: 'Restricted', characters: 'a', fsType: 0x0002 })],
  ] as const)('fails naming the source of a %s font, from either option', async (problem, bytes) => {
    for (const option of ['font', 'layerFont'] as const) {
      const error = await fillError(PdfFontError, 'Hello', { [option]: { bytes, source: 'fonts/bad.ttf' } })
      expect([error.source, error.problem]).toEqual(['fonts/bad.ttf', problem])
      expect(error.message).toContain('fonts/bad.ttf')
    }
  })

  it('accepts a font whose license permits editable embedding', async () => {
    const editable: PdfFont = { bytes: syntheticFont({ name: 'ParadocTestEditable', characters: 'Жук', fsType: 0x0008 }), source: 'editable.ttf' }
    expect((await fill('Жук', { layerFont: editable })).text).toBe('Жук')
  })
})

describe('overlays', () => {
  const overlayPdf = async (text: string, options: Pick<RenderPdfOptions, 'font' | 'layerFont'> = {}, width?: number) =>
    renderPdf({ template: pagePdf([[300, 300]]), data: {}, overlays: [{ page: 1, x: 20, y: 20, text, width }], ...options })

  it('draws overlay text in the declared font, embedded', async () => {
    const flat = await overlayPdf('Жук Ωμέγα', { layerFont: liberation })
    expect((await textItemsWithPdfjs(flat)).map((item) => item.text).join('')).toBe('Жук Ωμέγα')
    expect(await fontsWithPdfjs(flat)).toEqual([{ name: 'LiberationSans', missingFile: false }])
  })

  it('fails naming the overlay when no font can draw a character', async () => {
    const error = await overlayPdf('Жук').then(() => undefined, (caught: unknown) => caught as PdfFieldFillError)
    expect(error).toBeInstanceOf(PdfFieldFillError)
    expect([error!.field, error!.reason, error!.character]).toEqual(['text overlay 1 (page 1)', 'missing-glyph', 'Ж'])
  })

  it('rejects a script that needs shaping', async () => {
    await expect(overlayPdf('שלום', { layerFont: liberation })).rejects.toMatchObject({ reason: 'unsupported-script', script: 'Hebrew' })
  })

  it('shrinks to fit its width, and fails with an overflow error below the minimum size', async () => {
    const fitted = await textItemsWithPdfjs(await overlayPdf('A little wide', {}, 50))
    expect(fitted[0]!.size).toBeLessThan(12)
    expect(fitted[0]!.width).toBeLessThanOrEqual(50.01)
    await expect(overlayPdf('Far too long for twenty points', {}, 20)).rejects.toMatchObject({ reason: 'overflow', limit: 6 })
  })
})

describe('output', () => {
  it('fills with an embedded font byte-identically on repeat, and flattens', async () => {
    const template = acroFieldsPdf([field()])
    const render = () => renderPdf({ template, data: { value: 'Жук' }, bindings: { name: 'value' }, layerFont: liberation })
    const [first, second] = [await render(), await render()]
    expect(second).toEqual(first)
    expect(await flattenPdf(second)).toEqual(await flattenPdf(first))
    expect(await inspectAcroFormFields(await flattenPdf(first))).toEqual([])
  })

  it('leaves viewers to show the drawn appearances rather than regenerate them', async () => {
    const template = acroFieldsPdf([field()], { needAppearances: true })
    const filled = await renderPdf({ template, data: { value: 'Жук' }, bindings: { name: 'value' }, layerFont: liberation })
    const source = new TextDecoder('latin1').decode(filled)
    // The original AcroForm still says so; the updated one, appended after it, must not.
    const updated = source.slice(source.lastIndexOf('/Fields'))
    expect(source).toContain('/NeedAppearances true')
    expect(updated).not.toContain('/NeedAppearances')
  })
})
