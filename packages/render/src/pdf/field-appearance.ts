import type { FontMetrics } from './standard-font'

/** Why a value could not be drawn in its PDF form field. */
export type PdfFieldFillReason = 'overflow' | 'comb-length'

/** Thrown when a value cannot be drawn faithfully in a PDF form field, naming the field and the limit. */
export class PdfFieldFillError extends Error {
  /** Fully qualified name of the PDF form field. */
  readonly field: string
  readonly reason: PdfFieldFillReason
  /** The limit the value broke: the minimum font size in points, or the number of comb boxes. */
  readonly limit: number

  constructor(field: string, reason: PdfFieldFillReason, limit: number, detail: string) {
    super(`Cannot fill PDF field "${field}": ${detail}`)
    this.name = 'PdfFieldFillError'
    this.field = field
    this.reason = reason
    this.limit = limit
  }
}

/** Smallest size a value shrinks to before filling fails with an overflow error. */
export const MIN_FONT_SIZE = 6

/** Largest size automatic sizing chooses for a multiline field. */
const AUTO_MULTILINE_MAX = 12
const PADDING_X = 2
const PADDING_Y = 1
const LINE_SPACING = 1.15
const SHRINK_STEP = 0.5

/** The parts of a field's default appearance (`/DA`) that layout honors. */
export interface DefaultAppearance {
  /** Declared font size; 0 means automatic sizing. */
  size: number
  /** The color operator and its operands, such as `0 g` or `0 0 0.5 rg`. */
  color: string
}

/** Read the font size and color from a default appearance string. */
export function parseDefaultAppearance(value: string | undefined): DefaultAppearance {
  const tokens = (value ?? '').trim().split(/\s+/).filter(Boolean)
  let size = 0
  let color = '0 g'
  const operands = { g: 1, rg: 3, k: 4 } as const
  tokens.forEach((token, index) => {
    if (token === 'Tf') {
      const declared = Number(tokens[index - 1])
      size = Number.isFinite(declared) && declared > 0 ? declared : 0
    } else if (token in operands) {
      const count = operands[token as keyof typeof operands]
      const values = tokens.slice(index - count, index)
      if (values.length === count && values.every((item) => Number.isFinite(Number(item)))) {
        color = `${values.join(' ')} ${token}`
      }
    }
  })
  return { size, color }
}

/** Where and how a field draws its value. */
export interface FieldLayout {
  /** Fully qualified field name, used in errors. */
  field: string
  width: number
  height: number
  appearance: DefaultAppearance
  /** Quadding: 0 left, 1 centered, 2 right. */
  alignment: number
  /** Number of comb boxes, when the field is a comb field. */
  comb?: number
  multiline: boolean
}

const format = (value: number) => String(Number(value.toFixed(3)))

function show(fontName: string, size: number, x: number, y: number, text: string, encode: (text: string) => string): string {
  return `/${fontName} ${format(size)} Tf\n1 0 0 1 ${format(x)} ${format(y)} Tm\n(${encode(text)}) Tj`
}

function alignedX(layout: FieldLayout, lineWidth: number): number {
  if (layout.alignment === 1) return (layout.width - lineWidth) / 2
  if (layout.alignment === 2) return layout.width - PADDING_X - lineWidth
  return PADDING_X
}

/** Baseline that centers one line of glyphs vertically in the field. */
function centeredBaseline(layout: FieldLayout, font: FontMetrics, size: number): number {
  const glyphHeight = (font.ascent - font.descent) / 1000 * size
  return (layout.height - glyphHeight) / 2 - font.descent / 1000 * size
}

function overflow(layout: FieldLayout, floor: number): never {
  throw new PdfFieldFillError(
    layout.field,
    'overflow',
    floor,
    `the value does not fit at the minimum size of ${format(floor)} pt`,
  )
}

/** Wrap text into lines no wider than `width` at `size`, breaking words only when one alone is too wide. */
function wrap(text: string, font: FontMetrics, size: number, width: number): string[] {
  const measure = (value: string) => font.width(value) / 1000 * size
  const lines: string[] = []
  for (const paragraph of text.split(/\r\n|\r|\n/)) {
    let line = ''
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word
      if (measure(candidate) <= width) {
        line = candidate
        continue
      }
      if (line) lines.push(line)
      line = ''
      let rest = word
      while (measure(rest) > width && [...rest].length > 1) {
        const characters = [...rest]
        let count = 1
        while (count < characters.length && measure(characters.slice(0, count + 1).join('')) <= width) count++
        lines.push(characters.slice(0, count).join(''))
        rest = characters.slice(count).join('')
      }
      line = rest
    }
    lines.push(line)
  }
  return lines
}

/** The smallest size a value may shrink to: the minimum, or the declared size when that is already smaller. */
const sizeFloor = (layout: FieldLayout) =>
  layout.appearance.size ? Math.min(MIN_FONT_SIZE, layout.appearance.size) : MIN_FONT_SIZE

/**
 * The size for one line of glyphs: the declared size (or, when automatic, the
 * field height) reduced until a run `unitWidth` em wide fits `width`.
 */
function oneLineSize(layout: FieldLayout, font: FontMetrics, unitWidth: number, width: number): number {
  const heightFit = (layout.height - 2 * PADDING_Y) / ((font.ascent - font.descent) / 1000)
  const widthFit = unitWidth > 0 ? width / unitWidth : Number.POSITIVE_INFINITY
  const size = Math.min(layout.appearance.size || Number.POSITIVE_INFINITY, heightFit, widthFit)
  const floor = sizeFloor(layout)
  if (size < floor) overflow(layout, floor)
  return size
}

function singleLine(layout: FieldLayout, text: string, font: FontMetrics, fontName: string, encode: (text: string) => string): string {
  const unitWidth = font.width(text) / 1000
  const size = oneLineSize(layout, font, unitWidth, layout.width - 2 * PADDING_X)
  return show(fontName, size, alignedX(layout, unitWidth * size), centeredBaseline(layout, font, size), text, encode)
}

function combed(layout: FieldLayout, boxes: number, text: string, font: FontMetrics, fontName: string, encode: (text: string) => string): string {
  const characters = [...text]
  if (characters.length > boxes) {
    throw new PdfFieldFillError(
      layout.field,
      'comb-length',
      boxes,
      `the field has ${boxes} comb boxes, but the value has ${characters.length} characters`,
    )
  }
  const cell = layout.width / boxes
  const widest = Math.max(0, ...characters.map((character) => font.width(character) / 1000))
  const size = oneLineSize(layout, font, widest, cell)
  const unused = boxes - characters.length
  const first = layout.alignment === 1 ? Math.floor(unused / 2) : layout.alignment === 2 ? unused : 0
  const baseline = centeredBaseline(layout, font, size)
  return characters.map((character, index) => {
    const width = font.width(character) / 1000 * size
    const x = (first + index) * cell + (cell - width) / 2
    return show(fontName, size, x, baseline, character, encode)
  }).join('\n')
}

function multiline(layout: FieldLayout, text: string, font: FontMetrics, fontName: string, encode: (text: string) => string): string {
  const floor = sizeFloor(layout)
  const available = layout.width - 2 * PADDING_X
  const fits = (size: number, lines: string[]) =>
    lines.every((line) => font.width(line) / 1000 * size <= available)
    && 2 * PADDING_Y + (font.ascent - font.descent) / 1000 * size + (lines.length - 1) * LINE_SPACING * size <= layout.height

  const start = layout.appearance.size || AUTO_MULTILINE_MAX
  const candidates: number[] = []
  for (let size = start; size > floor; size -= SHRINK_STEP) candidates.push(size)
  candidates.push(floor)
  for (const size of candidates) {
    const lines = wrap(text, font, size, available)
    if (!fits(size, lines)) continue
    const firstBaseline = layout.height - PADDING_Y - font.ascent / 1000 * size
    return lines.map((line, index) => show(
      fontName,
      size,
      alignedX(layout, font.width(line) / 1000 * size),
      firstBaseline - index * LINE_SPACING * size,
      line,
      encode,
    )).join('\n')
  }
  return overflow(layout, floor)
}

/**
 * Lay out a value inside a field's box and return the text operators that draw
 * it, honoring the field's declared size or automatic sizing, alignment, comb
 * boxes, and multiline wrapping. A value that cannot fit at the minimum size,
 * or that has more characters than a comb field has boxes, fails naming the field.
 */
export function layoutFieldText(
  layout: FieldLayout,
  text: string,
  font: FontMetrics,
  fontName: string,
  encode: (text: string) => string,
): string {
  if (layout.comb !== undefined && layout.comb > 0 && !layout.multiline) {
    return combed(layout, layout.comb, text, font, fontName, encode)
  }
  if (layout.multiline) return multiline(layout, text, font, fontName, encode)
  return singleLine(layout, text.replace(/\r\n|\r|\n/g, ' '), font, fontName, encode)
}
