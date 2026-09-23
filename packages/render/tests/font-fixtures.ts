/**
 * Purpose-built TrueType fonts for tests.
 *
 * Every mapped character draws a filled box, so a test controls exactly which
 * characters a font covers, including scripts no small real font carries.
 */

import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)

/** Liberation Sans Regular, as pdf.js ships it: Latin, Latin Extended, Greek, and Cyrillic. */
export function liberationSans(): Uint8Array {
  const root = join(require.resolve('pdfjs-dist/package.json'), '..')
  return new Uint8Array(readFileSync(join(root, 'standard_fonts', 'LiberationSans-Regular.ttf')))
}

export interface SyntheticFontOptions {
  /** PostScript name. */
  name: string
  /** Every character the font maps to a glyph that draws a box. */
  characters: string
  /** Characters the font maps to a glyph with no outline. */
  blank?: string
  /** OS/2 embedding permissions. */
  fsType?: number
  /** Replace the sfnt version with another tag, such as `OTTO`. */
  signature?: string
}

class Writer {
  private readonly bytes: number[] = []
  u8(value: number) { this.bytes.push(value & 0xff); return this }
  u16(value: number) { return this.u8(value >> 8).u8(value) }
  i16(value: number) { return this.u16(value < 0 ? value + 0x10000 : value) }
  u32(value: number) { return this.u16(Math.floor(value / 0x10000)).u16(value & 0xffff) }
  tag(value: string) { for (const char of value) this.u8(char.charCodeAt(0)); return this }
  raw(values: Iterable<number>) { for (const value of values) this.u8(value); return this }
  get length() { return this.bytes.length }
  done() { return new Uint8Array(this.bytes) }
}

const UNITS = 1000
const ADVANCE = 600

/** One simple glyph: a single rectangular contour. */
function boxGlyph(): Uint8Array {
  const glyph = new Writer()
  glyph.i16(1).i16(50).i16(0).i16(550).i16(700) // one contour and its bounds
  glyph.u16(3) // last point index
  glyph.u16(0) // no instructions
  glyph.raw([0x01, 0x01, 0x01, 0x01]) // on-curve, 16-bit coordinates
  for (const x of [50, 500, 0, -500]) glyph.i16(x)
  for (const y of [0, 0, 700, 0]) glyph.i16(y)
  return glyph.done()
}

/** Build a TrueType font that maps the given characters to box glyphs. */
export function syntheticFont(options: SyntheticFontOptions): Uint8Array {
  const drawn = [...new Set([...options.characters])]
  const blank = [...new Set([...(options.blank ?? '')])]
  const mapped = [...drawn.map((char) => ({ char, outline: true })), ...blank.map((char) => ({ char, outline: false }))]
    .map((entry, index) => ({ ...entry, code: entry.char.codePointAt(0)!, glyph: index + 1 }))
    .sort((left, right) => left.code - right.code)
  const numGlyphs = mapped.length + 1

  const box = boxGlyph()
  const glyf = new Writer()
  // Glyph 0 (.notdef) is empty; each later glyph ends where the next begins.
  const locaOffsets = [0, 0]
  for (let glyph = 1; glyph < numGlyphs; glyph++) {
    if (mapped.find((item) => item.glyph === glyph)!.outline) glyf.raw(box)
    locaOffsets.push(glyf.length)
  }
  const loca = new Writer()
  for (const offset of locaOffsets) loca.u32(offset)

  const cmap = new Writer()
  cmap.u16(0).u16(1).u16(3).u16(10).u32(12)
  cmap.u16(12).u16(0).u32(16 + mapped.length * 12).u32(0).u32(mapped.length)
  for (const entry of mapped) cmap.u32(entry.code).u32(entry.code).u32(entry.glyph)

  const head = new Writer()
  head.u32(0x00010000).u32(0x00010000).u32(0).u32(0x5f0f3cf5).u16(0).u16(UNITS)
    .u32(0).u32(0).u32(0).u32(0).i16(0).i16(0).i16(ADVANCE).i16(700).u16(0).u16(8).i16(2).i16(1).i16(0)

  const hhea = new Writer()
  hhea.u32(0x00010000).i16(800).i16(-200).i16(0).u16(ADVANCE).i16(0).i16(0).i16(ADVANCE)
    .i16(1).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).u16(numGlyphs)

  const hmtx = new Writer()
  for (let glyph = 0; glyph < numGlyphs; glyph++) hmtx.u16(ADVANCE).i16(50)

  const maxp = new Writer()
  maxp.u32(0x00010000).u16(numGlyphs).u16(4).u16(1).u16(0).u16(0).u16(2).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0)

  const os2 = new Writer()
  os2.u16(4).i16(ADVANCE).u16(400).u16(5).u16(options.fsType ?? 0)
  for (let index = 0; index < 11; index++) os2.i16(0) // subscript to family class
  os2.raw(new Array(10).fill(0)) // panose
  os2.u32(0).u32(0).u32(0).u32(0).tag('PDOC').u16(0x40)
    .u16(Math.min(0xffff, mapped[0]?.code ?? 0)).u16(Math.min(0xffff, mapped.at(-1)?.code ?? 0))
    .i16(800).i16(-200).i16(0).u16(800).u16(200).u32(1).u32(0).i16(500).i16(700).u16(0).u16(32).u16(0)

  const post = new Writer()
  post.u32(0x00030000).u32(0).i16(-100).i16(50).u32(0).u32(0).u32(0).u32(0).u32(0)

  const name = new Writer()
  const encoded = [...options.name].flatMap((char) => [0, char.charCodeAt(0)])
  name.u16(0).u16(1).u16(18).u16(3).u16(1).u16(0x409).u16(6).u16(encoded.length).u16(0).raw(encoded)

  const tables: Array<[string, Uint8Array]> = [
    ['OS/2', os2.done()], ['cmap', cmap.done()], ['glyf', glyf.done()], ['head', head.done()],
    ['hhea', hhea.done()], ['hmtx', hmtx.done()], ['loca', loca.done()], ['maxp', maxp.done()],
    ['name', name.done()], ['post', post.done()],
  ]
  const font = new Writer()
  if (options.signature) font.tag(options.signature)
  else font.u32(0x00010000)
  font.u16(tables.length).u16(128).u16(3).u16(tables.length * 16 - 128)
  let offset = 12 + tables.length * 16
  const padded = tables.map(([, data]) => Math.ceil(data.length / 4) * 4)
  tables.forEach(([tag, data], index) => {
    font.tag(tag).u32(0).u32(offset).u32(data.length)
    offset += padded[index]!
  })
  tables.forEach(([, data], index) => {
    font.raw(data)
    for (let pad = data.length; pad < padded[index]!; pad++) font.u8(0)
  })
  return font.done()
}
