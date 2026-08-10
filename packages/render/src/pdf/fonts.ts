import { isDict, isName, type PdfDict, type PdfModel } from './syntax'
import { decodeStream } from './pages'

/** One glyph decoded from a shown string. */
export interface Glyph {
  /** Character code as it appears in the content stream. */
  code: number
  /** Unicode text for the glyph ('' when unmapped). */
  unicode: string
  /** Advance width in 1000ths of text space. */
  width: number
}

export interface FontDecoder {
  decode(bytes: number[]): Glyph[]
  twoByte: boolean
}

const decoder = new TextDecoder('latin1')

/** Parse a ToUnicode CMap stream into a code → text map. */
function parseToUnicode(cmap: string): Map<number, string> {
  const map = new Map<number, string>()

  const hexToString = (hex: string): string => {
    let text = ''
    for (let index = 0; index + 3 < hex.length + 1; index += 4) {
      text += String.fromCharCode(Number.parseInt(hex.slice(index, index + 4), 16))
    }
    return text
  }

  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const entry of block[1]!.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      map.set(Number.parseInt(entry[1]!, 16), hexToString(entry[2]!.padStart(Math.ceil(entry[2]!.length / 4) * 4, '0')))
    }
  }

  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    const body = block[1]!
    // Form: <lo> <hi> <dstStart>
    for (const entry of body.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      const low = Number.parseInt(entry[1]!, 16)
      const high = Number.parseInt(entry[2]!, 16)
      const start = entry[3]!.padStart(Math.ceil(entry[3]!.length / 4) * 4, '0')
      const base = hexToString(start)
      const last = base.charCodeAt(base.length - 1)
      for (let code = low; code <= high && code - low < 0x10000; code++) {
        map.set(code, base.slice(0, -1) + String.fromCharCode(last + (code - low)))
      }
    }
    // Form: <lo> <hi> [<dst> <dst> ...]
    for (const entry of body.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[([\s\S]*?)\]/g)) {
      const low = Number.parseInt(entry[1]!, 16)
      const targets = [...entry[3]!.matchAll(/<([0-9a-fA-F]+)>/g)]
      for (let offset = 0; offset < targets.length; offset++) {
        map.set(low + offset, hexToString(targets[offset]![1]!.padStart(Math.ceil(targets[offset]![1]!.length / 4) * 4, '0')))
      }
    }
  }

  return map
}

/** Widths for a simple (1-byte) font: /FirstChar + /Widths. */
function simpleWidths(model: PdfModel, font: PdfDict): (code: number) => number {
  const first = model.resolve(font.entries.get('FirstChar'))
  const widths = model.resolve(font.entries.get('Widths'))
  if (typeof first !== 'number' || !Array.isArray(widths)) return () => 500
  const table = widths.map((entry) => model.resolve(entry)).map((entry) => (typeof entry === 'number' ? entry : 0))
  return (code) => {
    const width = table[code - first]
    return typeof width === 'number' && width > 0 ? width : 500
  }
}

/** Widths for a Type0 font: descendant CIDFont /W + /DW (Identity encoding: CID = code). */
function cidWidths(model: PdfModel, font: PdfDict): (code: number) => number {
  const descendants = model.resolve(font.entries.get('DescendantFonts'))
  const descendant = Array.isArray(descendants) ? model.dict(descendants[0]) : undefined
  if (!descendant) return () => 1000
  const dw = model.resolve(descendant.entries.get('DW'))
  const defaultWidth = typeof dw === 'number' ? dw : 1000
  const w = model.resolve(descendant.entries.get('W'))
  const table = new Map<number, number>()
  if (Array.isArray(w)) {
    let index = 0
    while (index < w.length) {
      const start = model.resolve(w[index])
      const next = model.resolve(w[index + 1])
      if (typeof start !== 'number') break
      if (Array.isArray(next)) {
        const widths = next.map((entry) => model.resolve(entry))
        for (let offset = 0; offset < widths.length; offset++) {
          const width = widths[offset]
          if (typeof width === 'number') table.set(start + offset, width)
        }
        index += 2
      } else if (typeof next === 'number') {
        const width = model.resolve(w[index + 2])
        if (typeof width === 'number') {
          for (let code = start; code <= next && code - start < 0x10000; code++) table.set(code, width)
        }
        index += 3
      } else break
    }
  }
  return (code) => table.get(code) ?? defaultWidth
}

/** Build a decoder for a font dictionary found in page resources. */
export async function buildFontDecoder(model: PdfModel, font: PdfDict): Promise<FontDecoder> {
  const subtype = model.resolve(font.entries.get('Subtype'))
  const twoByte = isName(subtype) && subtype.value === 'Type0'

  let toUnicode: Map<number, string> | undefined
  const toUnicodeRecord = model.record(font.entries.get('ToUnicode'))
  if (toUnicodeRecord?.stream && isDict(toUnicodeRecord.value)) {
    const bytes = await decodeStream(model, toUnicodeRecord.value, toUnicodeRecord.stream)
    toUnicode = parseToUnicode(decoder.decode(bytes))
  }

  const widthOf = twoByte ? cidWidths(model, font) : simpleWidths(model, font)

  return {
    twoByte,
    decode(bytes: number[]): Glyph[] {
      const glyphs: Glyph[] = []
      if (twoByte) {
        for (let index = 0; index + 1 < bytes.length; index += 2) {
          const code = (bytes[index]! << 8) | bytes[index + 1]!
          glyphs.push({ code, unicode: toUnicode?.get(code) ?? '', width: widthOf(code) })
        }
      } else {
        for (const code of bytes) {
          // Without a ToUnicode map, standard encodings match Latin-1 closely
          // enough for marker and underscore detection.
          glyphs.push({ code, unicode: toUnicode?.get(code) ?? String.fromCharCode(code), width: widthOf(code) })
        }
      }
      return glyphs
    },
  }
}
