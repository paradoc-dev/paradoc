import { isDict, isName, type PdfDict, type PdfModel } from './syntax'
import { containsEncoding } from './encoding'
import { buildFontDecoder, type FontDecoder } from './fonts'
import { decodeStream, type PdfPage } from './pages'

/** One text-showing run, in content-stream order. */
export interface TextRun {
  /** Decoded Unicode text of the run. */
  text: string
  /** Device-space x of the run start, in points. */
  x: number
  /** Device-space y of the run start (bottom-origin), in points. */
  y: number
  /** Advance width of the run in device space, in points. */
  width: number
  /** Effective font height in device space, in points. */
  height: number
}

/**
 * Merge contiguous same-line runs into pdf.js-like text items. Writers such
 * as LibreOffice position every glyph with its own show operation; word-level
 * analysis (underscore widths, anchor text search) needs items that span
 * whole words, the shape pdf.js presents. Marker runs stay unmerged,
 * matching pdf.js item breaks on font changes.
 */
export function mergeRuns(runs: TextRun[]): TextRun[] {
  const merged: TextRun[] = []
  for (const run of runs) {
    const previous = merged[merged.length - 1]
    const boundary = !previous || containsEncoding(previous.text) || containsEncoding(run.text)
    if (
      !boundary &&
      Math.abs(run.y - previous.y) < 0.5 &&
      Math.abs(run.x - (previous.x + previous.width)) < 1
    ) {
      previous.text += run.text
      previous.width = run.x + run.width - previous.x
      previous.height = Math.max(previous.height, run.height)
      continue
    }
    merged.push({ ...run })
  }
  return merged
}

/** Row-major 2D transform [a, b, c, d, e, f]. */
type Matrix = [number, number, number, number, number, number]

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ]
}

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'string'; bytes: number[] }
  | { kind: 'name'; value: string }
  | { kind: 'array'; items: Token[] }
  | { kind: 'operator'; value: string }

const decoder = new TextDecoder('latin1')

/** Tokenize a content stream. Dictionaries and inline images are skipped. */
function tokenize(content: Uint8Array): Token[] {
  const source = decoder.decode(content)
  const tokens: Token[] = []
  let position = 0
  const stack: Token[][] = [tokens]

  const isWhitespace = (char: string): boolean => /[\s\0]/.test(char)
  const isDelimiter = (char: string | undefined): boolean =>
    char === undefined || isWhitespace(char) || '()<>[]{}/%'.includes(char)

  while (position < source.length) {
    const char = source[position]!
    if (isWhitespace(char)) {
      position++
      continue
    }
    if (char === '%') {
      while (position < source.length && !'\r\n'.includes(source[position]!)) position++
      continue
    }
    const sink = stack[stack.length - 1]!

    if (char === '[') {
      const items: Token[] = []
      sink.push({ kind: 'array', items })
      stack.push(items)
      position++
      continue
    }
    if (char === ']') {
      if (stack.length > 1) stack.pop()
      position++
      continue
    }
    if (char === '(') {
      position++
      const bytes: number[] = []
      let depth = 1
      while (position < source.length && depth > 0) {
        const current = source[position++]!
        if (current === '\\') {
          const escaped = source[position++]
          if (escaped === undefined) break
          const simple: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12, '(': 40, ')': 41, '\\': 92 }
          if (simple[escaped] !== undefined) bytes.push(simple[escaped]!)
          else if (escaped === '\n') continue
          else if (escaped === '\r') {
            if (source[position] === '\n') position++
          } else if (/[0-7]/.test(escaped)) {
            let octal = escaped
            while (octal.length < 3 && /[0-7]/.test(source[position] ?? '')) octal += source[position++]!
            bytes.push(Number.parseInt(octal, 8) & 0xff)
          } else bytes.push(escaped.charCodeAt(0))
        } else if (current === '(') {
          depth++
          bytes.push(40)
        } else if (current === ')') {
          depth--
          if (depth > 0) bytes.push(41)
        } else bytes.push(current.charCodeAt(0) & 0xff)
      }
      sink.push({ kind: 'string', bytes })
      continue
    }
    if (char === '<' && source[position + 1] === '<') {
      // Inline dictionary (marked content, inline image parameters): skip balanced.
      let depth = 0
      while (position < source.length) {
        if (source.startsWith('<<', position)) {
          depth++
          position += 2
        } else if (source.startsWith('>>', position)) {
          depth--
          position += 2
          if (depth === 0) break
        } else position++
      }
      continue
    }
    if (char === '<') {
      position++
      const start = position
      while (position < source.length && source[position] !== '>') position++
      let hex = source.slice(start, position++).replace(/\s/g, '')
      if (hex.length % 2 === 1) hex += '0'
      const bytes: number[] = []
      for (let index = 0; index < hex.length; index += 2) bytes.push(Number.parseInt(hex.slice(index, index + 2), 16))
      sink.push({ kind: 'string', bytes })
      continue
    }
    if (char === '/') {
      position++
      const start = position
      while (!isDelimiter(source[position])) position++
      sink.push({
        kind: 'name',
        value: source
          .slice(start, position)
          .replace(/#([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16))),
      })
      continue
    }
    if (/[-+.\d]/.test(char)) {
      const start = position
      while (/[-+.\d]/.test(source[position] ?? '')) position++
      const value = Number(source.slice(start, position))
      sink.push({ kind: 'number', value: Number.isFinite(value) ? value : 0 })
      continue
    }
    // Operator: a run of regular characters.
    const start = position
    while (!isDelimiter(source[position]) && !/[-+.\d]/.test(source[position] ?? '')) position++
    const operator = source.slice(start, position)
    if (operator === 'BI') {
      // Inline image: skip to EI bounded by whitespace.
      const match = /\sEI(?=[\s\0]|$)/.exec(source.slice(position))
      position = match ? position + match.index + match[0].length : source.length
      continue
    }
    if (operator.length > 0) sink.push({ kind: 'operator', value: operator })
    else position++
  }

  return tokens
}

interface GraphicsState {
  ctm: Matrix
  font: FontDecoder | undefined
  fontSize: number
  charSpacing: number
  wordSpacing: number
  horizontalScale: number
  leading: number
  rise: number
}

/** Interpret a page's content stream and emit text runs in stream order. */
export async function scanPage(model: PdfModel, page: PdfPage): Promise<TextRun[]> {
  const runs: TextRun[] = []
  const fontCache = new Map<PdfDict, FontDecoder>()

  const fontFor = async (resources: PdfDict | undefined, name: string): Promise<FontDecoder | undefined> => {
    const fonts = resources ? model.dict(resources.entries.get('Font')) : undefined
    const dict = fonts ? model.dict(fonts.entries.get(name)) : undefined
    if (!dict) return undefined
    let cached = fontCache.get(dict)
    if (!cached) {
      cached = await buildFontDecoder(model, dict)
      fontCache.set(dict, cached)
    }
    return cached
  }

  const interpret = async (content: Uint8Array, resources: PdfDict | undefined, base: Matrix, depth: number): Promise<void> => {
    if (depth > 8) return
    const tokens = tokenize(content)
    const state: GraphicsState = {
      ctm: base,
      font: undefined,
      fontSize: 0,
      charSpacing: 0,
      wordSpacing: 0,
      horizontalScale: 1,
      leading: 0,
      rise: 0,
    }
    const saved: GraphicsState[] = []
    let textMatrix: Matrix = IDENTITY
    let lineMatrix: Matrix = IDENTITY
    const operands: Token[] = []

    const numbers = (count: number): number[] => {
      const slice = operands.slice(-count)
      return slice.map((token) => (token.kind === 'number' ? token.value : 0))
    }

    const nextLine = (tx: number, ty: number): void => {
      lineMatrix = multiply([1, 0, 0, 1, tx, ty], lineMatrix)
      textMatrix = lineMatrix
    }

    const show = (bytes: number[]): void => {
      if (!state.font || bytes.length === 0) return
      const glyphs = state.font.decode(bytes)
      const trm = multiply(
        multiply([state.fontSize * state.horizontalScale, 0, 0, state.fontSize, 0, state.rise], textMatrix),
        state.ctm,
      )
      let advance = 0
      let text = ''
      for (const glyph of glyphs) {
        text += glyph.unicode
        const word = !state.font.twoByte && glyph.code === 32 ? state.wordSpacing : 0
        advance += ((glyph.width / 1000) * state.fontSize + state.charSpacing + word) * state.horizontalScale
      }
      const scale = Math.hypot(multiply(textMatrix, state.ctm)[0]!, multiply(textMatrix, state.ctm)[1]!)
      runs.push({
        text,
        x: trm[4],
        y: trm[5],
        width: advance * scale,
        height: Math.hypot(trm[2], trm[3]),
      })
      textMatrix = multiply([1, 0, 0, 1, advance, 0], textMatrix)
    }

    const adjust = (amount: number): void => {
      const tx = ((-amount / 1000) * state.fontSize) * state.horizontalScale
      textMatrix = multiply([1, 0, 0, 1, tx, 0], textMatrix)
    }

    for (const token of tokens) {
      if (token.kind !== 'operator') {
        operands.push(token)
        continue
      }
      const op = token.value
      switch (op) {
        case 'q':
          saved.push({ ...state })
          break
        case 'Q': {
          const restored = saved.pop()
          if (restored) Object.assign(state, restored)
          break
        }
        case 'cm': {
          const [a, b, c, d, e, f] = numbers(6)
          state.ctm = multiply([a!, b!, c!, d!, e!, f!], state.ctm)
          break
        }
        case 'BT':
          textMatrix = IDENTITY
          lineMatrix = IDENTITY
          break
        case 'ET':
          break
        case 'Tf': {
          const size = numbers(1)[0] ?? 0
          const name = operands.at(-2)
          state.fontSize = size
          if (name?.kind === 'name') state.font = await fontFor(resources, name.value)
          break
        }
        case 'Td': {
          const [tx, ty] = numbers(2)
          nextLine(tx!, ty!)
          break
        }
        case 'TD': {
          const [tx, ty] = numbers(2)
          state.leading = -ty!
          nextLine(tx!, ty!)
          break
        }
        case 'Tm': {
          const [a, b, c, d, e, f] = numbers(6)
          textMatrix = [a!, b!, c!, d!, e!, f!]
          lineMatrix = textMatrix
          break
        }
        case 'T*':
          nextLine(0, -state.leading)
          break
        case 'TL':
          state.leading = numbers(1)[0] ?? 0
          break
        case 'Tc':
          state.charSpacing = numbers(1)[0] ?? 0
          break
        case 'Tw':
          state.wordSpacing = numbers(1)[0] ?? 0
          break
        case 'Tz':
          state.horizontalScale = (numbers(1)[0] ?? 100) / 100
          break
        case 'Ts':
          state.rise = numbers(1)[0] ?? 0
          break
        case 'Tj': {
          const operand = operands.at(-1)
          if (operand?.kind === 'string') show(operand.bytes)
          break
        }
        case "'": {
          nextLine(0, -state.leading)
          const operand = operands.at(-1)
          if (operand?.kind === 'string') show(operand.bytes)
          break
        }
        case '"': {
          const spacing = numbers(3)
          state.wordSpacing = spacing[0] ?? 0
          state.charSpacing = spacing[1] ?? 0
          nextLine(0, -state.leading)
          const operand = operands.at(-1)
          if (operand?.kind === 'string') show(operand.bytes)
          break
        }
        case 'TJ': {
          const operand = operands.at(-1)
          if (operand?.kind === 'array') {
            for (const item of operand.items) {
              if (item.kind === 'string') show(item.bytes)
              else if (item.kind === 'number') adjust(item.value)
            }
          }
          break
        }
        case 'Do': {
          const name = operands.at(-1)
          if (name?.kind !== 'name') break
          const xobjects = resources ? model.dict(resources.entries.get('XObject')) : undefined
          const record = xobjects ? model.record(xobjects.entries.get(name.value)) : undefined
          if (!record?.stream || !isDict(record.value)) break
          const subtype = model.resolve(record.value.entries.get('Subtype'))
          if (!isName(subtype) || subtype.value !== 'Form') break
          const matrixValues = model.resolve(record.value.entries.get('Matrix'))
          const matrix: Matrix =
            Array.isArray(matrixValues) && matrixValues.length === 6 && matrixValues.every((entry) => typeof entry === 'number')
              ? (matrixValues as Matrix)
              : IDENTITY
          const formResources = model.dict(record.value.entries.get('Resources')) ?? resources
          const bytes = await decodeStream(model, record.value, record.stream)
          await interpret(bytes, formResources, multiply(matrix, state.ctm), depth + 1)
          break
        }
        default:
          break
      }
      operands.length = 0
    }
  }

  await interpret(page.content, page.resources, IDENTITY, 0)
  return runs
}
