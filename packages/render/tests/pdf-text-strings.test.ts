/**
 * PDF text strings (ISO 32000-2, 7.9.2 and Annex D).
 *
 * A text string is UTF-16BE after a FE FF byte order mark, UTF-8 after an
 * EF BB BF one, and PDFDocEncoding otherwise. PDFDocEncoding differs from
 * both ISO-8859-1 and windows-1252 in 0x18–0x1F and 0x80–0xA0, so reading
 * file bytes as either of those misreads values such as "文" (FE FF 65 87)
 * and "•—™" (80 84 92). Read results are checked against pdf.js.
 */

import type { Form } from '@paradoc/types'
import { describe, expect, it } from 'vitest'
import { extractPdfData, inspectAcroFormFields, renderPdf, type PdfFont } from '../src/pdf'
import { decodeTextString, encodeTextString } from '../src/pdf/text-string'
import { liberationSans, syntheticFont } from './font-fixtures'
import { acroFormPdf } from './pdf-fixtures'
import { fieldValuesWithPdfjs } from './pdfjs-reference'

const bytes = (value: string) => [...value].map((char) => char.charCodeAt(0))
const byteString = (values: number[]) => String.fromCharCode(...values)

const cjk: PdfFont = { bytes: syntheticFont({ name: 'ParadocTestCJK', characters: '中文字漢𠀋 ' }), source: 'fonts/test-cjk.ttf' }
const liberation: PdfFont = { bytes: liberationSans(), source: 'fonts/LiberationSans-Regular.ttf' }

describe('decodeTextString', () => {
  it.each([
    ['UTF-16BE whose low byte falls in 0x80–0x9F', [0xfe, 0xff, 0x65, 0x87], '文'],
    ['UTF-16BE with a surrogate pair', [0xfe, 0xff, 0xd8, 0x40, 0xdc, 0x0b], '𠀋'],
    ['UTF-8 after its byte order mark', [0xef, 0xbb, 0xbf, 0xe6, 0x96, 0x87, 0x41], '文A'],
    ['PDFDocEncoding punctuation in 0x80–0x9F', [0x80, 0x84, 0x92], '•—™'],
    ['PDFDocEncoding accents in 0x18–0x1F', [0x18, 0x19, 0x1f], '˘ˇ˜'],
    ['PDFDocEncoding euro sign at 0xA0', [0xa0], '€'],
    ['PDFDocEncoding Latin-1 range', [0x63, 0x61, 0x66, 0xe9], 'café'],
    ['plain ASCII', bytes('Jane Q. Public'), 'Jane Q. Public'],
  ])('reads %s', (_case, input, text) => {
    expect(decodeTextString(byteString(input))).toBe(text)
  })

  it('drops the language escape sequence a Unicode string may carry', () => {
    expect(decodeTextString(byteString([0xfe, 0xff, 0x00, 0x1b, 0x00, 0x6a, 0x00, 0x61, 0x00, 0x1b, 0x65, 0x87]))).toBe('文')
  })

  it('keeps an undefined PDFDocEncoding code as its Latin-1 character instead of dropping it', () => {
    expect(decodeTextString(byteString([0x9f, 0x7f]))).toBe('\u009f\u007f')
  })
})

describe('encodeTextString', () => {
  it.each([
    ['plain ASCII', 'Jane Q. Public', bytes('Jane Q. Public')],
    ['PDFDocEncoding punctuation', '•—™', [0x80, 0x84, 0x92]],
    ['PDFDocEncoding accents and Latin-1', '˘é€', [0x18, 0xe9, 0xa0]],
    ['CJK as UTF-16BE', '文', [0xfe, 0xff, 0x65, 0x87]],
    ['a surrogate pair as UTF-16BE', '𠀋', [0xfe, 0xff, 0xd8, 0x40, 0xdc, 0x0b]],
    ['a character PDFDocEncoding leaves undefined as UTF-16BE', '\u00ad', [0xfe, 0xff, 0x00, 0xad]],
  ])('stores %s', (_case, text, expected) => {
    const encoded = encodeTextString(text)
    expect(bytes(encoded)).toEqual(expected)
    expect(decodeTextString(encoded)).toBe(text)
  })
})

describe('reading field text from a PDF', () => {
  const pdf = acroFormPdf([
    { kind: 'text', name: '文', valueBytes: [0xfe, 0xff, 0x65, 0x87, 0x5b, 0x57] },
    { kind: 'text', name: 'punctuation', valueBytes: [0x80, 0x20, 0x84, 0x20, 0x92] },
    { kind: 'text', name: 'utf8', valueBytes: [0xef, 0xbb, 0xbf, 0xe6, 0x96, 0x87] },
    { kind: 'text', name: 'ascii', value: 'Plain text' },
    { kind: 'choice', name: 'city', options: ['東京', 'Paris'], value: '東京' },
  ])

  it('decodes names and values the way pdf.js does', async () => {
    const fields = await inspectAcroFormFields(pdf)
    const values = Object.fromEntries(fields.map((field) => [field.name, field.value]))
    expect(values).toEqual({ '文': '文字', punctuation: '• — ™', utf8: '文', ascii: 'Plain text', city: ['東京'] })
    const reference = await fieldValuesWithPdfjs(pdf)
    expect(reference).toMatchObject({ '文': '文字', punctuation: '• — ™', ascii: 'Plain text', city: '東京' })
  })
})

describe('writing field text into a PDF', () => {
  it('stores CJK as UTF-16BE that pdf.js and the inspector read back', async () => {
    const filled = await renderPdf({
      template: acroFormPdf([{ kind: 'text', name: 'name' }]),
      data: { value: '中文字𠀋' },
      bindings: { name: 'value' },
      layerFont: cjk,
    })
    expect(await fieldValuesWithPdfjs(filled)).toEqual({ name: '中文字𠀋' })
    expect((await inspectAcroFormFields(filled))[0]?.value).toBe('中文字𠀋')
  })

  it('stores PDFDocEncoding punctuation as its single-byte codes', async () => {
    const filled = await renderPdf({
      template: acroFormPdf([{ kind: 'text', name: 'name' }]),
      data: { value: '• — ™' },
      bindings: { name: 'value' },
      layerFont: liberation,
    })
    expect(new TextDecoder('ascii').decode(filled)).toContain('/V <8020842092>')
    expect(await fieldValuesWithPdfjs(filled)).toEqual({ name: '• — ™' })
    expect((await inspectAcroFormFields(filled))[0]?.value).toBe('• — ™')
  })

  it('selects a dropdown option whose export value is CJK, keeping the option list intact', async () => {
    const filled = await renderPdf({
      template: acroFormPdf([{ kind: 'choice', name: 'city', options: ['東京', 'Paris'] }]),
      data: { value: '東京' },
      bindings: { city: 'value' },
      layerFont: { bytes: syntheticFont({ name: 'ParadocTestCity', characters: '東京 ' }), source: 'fonts/city.ttf' },
    })
    expect(await fieldValuesWithPdfjs(filled)).toEqual({ city: '東京' })
    expect(new TextDecoder('ascii').decode(filled)).toMatch(/\/I \[0\]/)
  })
})

describe('extracting field text', () => {
  const form = {
    kind: 'form',
    name: 'text-strings',
    version: '1.0.0',
    title: 'Text strings',
    fields: { name: { type: 'text', label: 'Name' } },
  } as unknown as Form

  it('returns a CJK value the fill path wrote', async () => {
    const pdf = await renderPdf({ template: acroFormPdf([{ kind: 'text', name: 'name' }]), form, data: { name: '中文字' }, bindings: { name: 'name' }, layerFont: cjk })
    const result = await extractPdfData({ pdf, form, bindings: { name: 'name' } })
    expect(result.data.fields).toEqual({ name: '中文字' })
  })

  it('returns a PDFDocEncoded value another writer stored', async () => {
    const pdf = acroFormPdf([{ kind: 'text', name: 'name', valueBytes: [0x93, 0x6e, 0x61, 0x6c, 0x20, 0x84, 0x20, 0x9b, 0xf3, 0x64] }])
    const result = await extractPdfData({ pdf, form, bindings: { name: 'name' } })
    expect(result.data.fields).toEqual({ name: 'ﬁnal — łód' })
  })
})
