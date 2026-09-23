/**
 * A minimal reader for TrueType-outline font programs: enough to map
 * characters to glyphs, measure them, decide whether a glyph really draws
 * something, and describe the font to a PDF reader. Nothing is shaped.
 */

/** Why a font program could not be used. */
export type FontProgramProblem = 'unreadable' | 'unsupported-format' | 'not-embeddable'

export class FontProgramError extends Error {
  readonly problem: FontProgramProblem

  constructor(problem: FontProgramProblem, detail: string) {
    super(detail)
    this.name = 'FontProgramError'
    this.problem = problem
  }
}

export interface TrueTypeFont {
  /** PostScript name, safe to use as a PDF name. */
  postScriptName: string
  unitsPerEm: number
  /** In font units. */
  ascent: number
  /** In font units, negative below the baseline. */
  descent: number
  capHeight: number
  bbox: [number, number, number, number]
  italicAngle: number
  fixedPitch: boolean
  numGlyphs: number
  /** Glyph for a Unicode code point, or 0 when the font has none. */
  glyphFor(codePoint: number): number
  /** Advance width of a glyph in font units. */
  advance(glyph: number): number
  /** True when the glyph has outline data, so drawing it paints something. */
  hasOutline(glyph: number): boolean
}

interface Table { offset: number; length: number }

function tag(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset]!, bytes[offset + 1]!, bytes[offset + 2]!, bytes[offset + 3]!)
}

/** Parse a TrueType-outline font program, rejecting what cannot be embedded as one. */
export function parseTrueType(bytes: Uint8Array): TrueTypeFont {
  if (bytes.length < 12) throw new FontProgramError('unreadable', 'the data is too short to be a font')
  const signature = tag(bytes, 0)
  if (signature === 'OTTO') {
    throw new FontProgramError('unsupported-format', 'it is an OpenType font with CFF outlines; use a font with TrueType outlines (.ttf)')
  }
  if (signature === 'ttcf') throw new FontProgramError('unsupported-format', 'it is a font collection; use a single .ttf font')
  if (signature === 'wOFF' || signature === 'wOF2') throw new FontProgramError('unsupported-format', 'it is a WOFF web font; use the .ttf font it was made from')
  const version = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0)
  if (version !== 0x00010000 && signature !== 'true') throw new FontProgramError('unreadable', 'it is not a TrueType or OpenType font')

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const u16 = (offset: number) => view.getUint16(offset)
  const i16 = (offset: number) => view.getInt16(offset)
  const u32 = (offset: number) => view.getUint32(offset)

  try {
    const tables = new Map<string, Table>()
    const count = u16(4)
    for (let index = 0; index < count; index++) {
      const record = 12 + index * 16
      const table = { offset: u32(record + 8), length: u32(record + 12) }
      if (table.offset + table.length > bytes.length) throw new FontProgramError('unreadable', `its ${tag(bytes, record)} table is truncated`)
      tables.set(tag(bytes, record), table)
    }
    const required = (name: string): Table => {
      const table = tables.get(name)
      if (!table) {
        throw new FontProgramError(name === 'glyf' || name === 'loca' ? 'unsupported-format' : 'unreadable', `it has no ${name} table`)
      }
      return table
    }

    const head = required('head').offset
    const unitsPerEm = u16(head + 18)
    const bbox: [number, number, number, number] = [i16(head + 36), i16(head + 38), i16(head + 40), i16(head + 42)]
    const longLoca = i16(head + 50) === 1
    const hhea = required('hhea').offset
    const numberOfHMetrics = u16(hhea + 34)
    const numGlyphs = u16(required('maxp').offset + 4)
    const hmtx = required('hmtx').offset
    const loca = required('loca').offset
    required('glyf')

    let ascent = i16(hhea + 4)
    let descent = i16(hhea + 6)
    let capHeight = ascent
    const os2 = tables.get('OS/2')
    if (os2) {
      const fsType = u16(os2.offset + 8)
      if ((fsType & 0x000f) === 0x0002) throw new FontProgramError('not-embeddable', 'its license forbids embedding (restricted license)')
      if ((fsType & 0x0200) !== 0) throw new FontProgramError('not-embeddable', 'its license allows embedding bitmaps only')
      const os2Version = u16(os2.offset)
      if (os2Version >= 2 && os2.length >= 90) capHeight = i16(os2.offset + 88)
      if (ascent === 0 && descent === 0) {
        ascent = i16(os2.offset + 68)
        descent = i16(os2.offset + 70)
      }
    }

    const post = tables.get('post')
    const italicAngle = post ? view.getInt32(post.offset + 4) / 65536 : 0
    const fixedPitch = post ? u32(post.offset + 12) !== 0 : false

    const glyphOffset = (glyph: number) => longLoca ? u32(loca + glyph * 4) : u16(loca + glyph * 2) * 2
    const hasOutline = (glyph: number) => glyph > 0 && glyph < numGlyphs && glyphOffset(glyph + 1) > glyphOffset(glyph)
    const advance = (glyph: number) => {
      const metric = Math.min(glyph, numberOfHMetrics - 1)
      return u16(hmtx + metric * 4)
    }

    const glyphFor = characterMap(tables.get('cmap'), u16, u32)
    const postScriptName = nameOf(tables.get('name'), bytes, u16) ?? 'EmbeddedFont'

    return {
      postScriptName: postScriptName.replace(/[^!-~]|[()<>[\]{}/%#]/g, ''),
      unitsPerEm,
      ascent,
      descent,
      capHeight,
      bbox,
      italicAngle,
      fixedPitch,
      numGlyphs,
      glyphFor: (codePoint) => {
        const glyph = glyphFor(codePoint)
        return glyph < numGlyphs ? glyph : 0
      },
      advance,
      hasOutline,
    }
  } catch (error) {
    if (error instanceof FontProgramError) throw error
    throw new FontProgramError('unreadable', 'its tables could not be read')
  }
}

/** The best Unicode character map: format 12 when present, else format 4. */
function characterMap(
  table: Table | undefined,
  u16: (offset: number) => number,
  u32: (offset: number) => number,
): (codePoint: number) => number {
  if (!table) throw new FontProgramError('unreadable', 'it has no cmap table')
  const subtables: Array<{ platform: number; encoding: number; offset: number; format: number }> = []
  const count = u16(table.offset + 2)
  for (let index = 0; index < count; index++) {
    const record = table.offset + 4 + index * 8
    const offset = table.offset + u32(record + 4)
    subtables.push({ platform: u16(record), encoding: u16(record + 2), offset, format: u16(offset) })
  }
  const unicode = (entry: (typeof subtables)[number]) =>
    entry.platform === 0 || (entry.platform === 3 && (entry.encoding === 1 || entry.encoding === 10))
  const full = subtables.find((entry) => unicode(entry) && entry.format === 12)
  if (full) {
    const groups = u32(full.offset + 12)
    return (codePoint) => {
      let low = 0
      let high = groups - 1
      while (low <= high) {
        const middle = (low + high) >> 1
        const group = full.offset + 16 + middle * 12
        const start = u32(group)
        const end = u32(group + 4)
        if (codePoint < start) high = middle - 1
        else if (codePoint > end) low = middle + 1
        else return u32(group + 8) + codePoint - start
      }
      return 0
    }
  }
  const basic = subtables.find((entry) => unicode(entry) && entry.format === 4)
  if (!basic) throw new FontProgramError('unsupported-format', 'it has no Unicode character map')
  const segments = u16(basic.offset + 6) / 2
  const ends = basic.offset + 14
  const starts = ends + segments * 2 + 2
  const deltas = starts + segments * 2
  const ranges = deltas + segments * 2
  return (codePoint) => {
    if (codePoint > 0xffff) return 0
    for (let segment = 0; segment < segments; segment++) {
      if (codePoint > u16(ends + segment * 2)) continue
      const start = u16(starts + segment * 2)
      if (codePoint < start) return 0
      const delta = u16(deltas + segment * 2)
      const rangeOffset = u16(ranges + segment * 2)
      if (rangeOffset === 0) return (codePoint + delta) & 0xffff
      const glyph = u16(ranges + segment * 2 + rangeOffset + (codePoint - start) * 2)
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff
    }
    return 0
  }
}

/** The font's PostScript name (name ID 6). */
function nameOf(table: Table | undefined, bytes: Uint8Array, u16: (offset: number) => number): string | undefined {
  if (!table) return undefined
  const count = u16(table.offset + 2)
  const storage = table.offset + u16(table.offset + 4)
  for (let index = 0; index < count; index++) {
    const record = table.offset + 6 + index * 12
    if (u16(record + 6) !== 6) continue
    const platform = u16(record)
    const length = u16(record + 8)
    const start = storage + u16(record + 10)
    const raw = bytes.subarray(start, start + length)
    if (platform === 3 || platform === 0) {
      let text = ''
      for (let offset = 0; offset + 1 < raw.length; offset += 2) text += String.fromCharCode((raw[offset]! << 8) | raw[offset + 1]!)
      return text
    }
    return String.fromCharCode(...raw)
  }
  return undefined
}
