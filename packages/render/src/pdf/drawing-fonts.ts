import { zlibSync } from 'fflate'
import { PdfFieldFillError, type DrawingFont } from './field-appearance'
import { decodeStream } from './pages'
import { helvetica } from './standard-font'
import { isName, isRef, type PdfDict, type PdfModel, type PdfRef, type PdfValue } from './syntax'
import { FontProgramError, parseTrueType, type FontProgramProblem, type TrueTypeFont } from './truetype'
import { winAnsiCodes, winAnsiText } from './win-ansi'

/** A font program supplied to the PDF renderer, and the name its errors use for it. */
export interface PdfFont {
  /** A TrueType-outline font program (.ttf, or .otf with TrueType outlines). */
  bytes: Uint8Array
  /** Where the font came from, such as its path. Errors name the font by this. */
  source: string
}

/** Thrown when a supplied font cannot be used, naming its source. */
export class PdfFontError extends Error {
  readonly source: string
  readonly problem: FontProgramProblem

  constructor(source: string, problem: FontProgramProblem, detail: string) {
    super(`Cannot use font "${source}": ${detail}`)
    this.name = 'PdfFontError'
    this.source = source
    this.problem = problem
  }
}

/**
 * Scripts that need glyph shaping or right-to-left ordering. Filling draws one
 * glyph per character, left to right, so it cannot draw these faithfully.
 */
const SHAPED_SCRIPTS = [
  'Arabic', 'Hebrew', 'Syriac', 'Thaana', 'Nko', 'Adlam', 'Mandaic', 'Samaritan',
  'Devanagari', 'Bengali', 'Gurmukhi', 'Gujarati', 'Oriya', 'Tamil', 'Telugu', 'Kannada',
  'Malayalam', 'Sinhala', 'Thai', 'Lao', 'Tibetan', 'Myanmar', 'Khmer', 'Mongolian',
].map((script) => ({ script, pattern: new RegExp(`\\p{Script=${script}}`, 'u') }))

const LINE_BREAK = /[\r\n]/u
const WHITESPACE = /\s/u

const hex4 = (value: number) => value.toString(16).padStart(4, '0').toUpperCase()

/** A font this render can draw with, embedded in the output the first time it is used. */
interface CandidateFont extends DrawingFont {
  /** True when every character of `text` has a glyph that paints. */
  covers(text: string): boolean
  /** The font dictionary reference, embedding the font on first use. */
  reference(): PdfRef
  /** Write what depends on the glyphs used: widths and the Unicode map. */
  finish(): void
}

class StandardHelvetica implements CandidateFont {
  readonly resourceName = 'PdrFontHelvetica'
  readonly ascent = helvetica.ascent
  readonly descent = helvetica.descent
  private ref?: PdfRef

  constructor(private readonly model: PdfModel) {}

  covers(text: string): boolean {
    try {
      winAnsiCodes(text)
      return true
    } catch {
      return false
    }
  }

  width(text: string): number {
    return helvetica.width(text)
  }

  encode(text: string): string {
    return `(${winAnsiText(text)})`
  }

  reference(): PdfRef {
    this.ref ??= this.model.addObject({
      kind: 'dict',
      entries: new Map<string, PdfValue>([
        ['Type', { kind: 'name', value: 'Font' }],
        ['Subtype', { kind: 'name', value: 'Type1' }],
        ['BaseFont', { kind: 'name', value: 'Helvetica' }],
        ['Encoding', { kind: 'name', value: 'WinAnsiEncoding' }],
      ]),
    })
    return this.ref
  }

  finish(): void {}
}

/**
 * A TrueType program drawn through a Type0 font with Identity-H encoding, so
 * each character is shown by its glyph index. The program is embedded whole:
 * either the supplied bytes, or the form's own embedded program by reference.
 */
class EmbeddedTrueType implements CandidateFont {
  readonly ascent: number
  readonly descent: number
  private readonly scale: number
  private readonly used = new Map<number, string>()
  private font?: PdfRef
  private descendant?: PdfDict
  private type0?: PdfDict

  constructor(
    private readonly model: PdfModel,
    private readonly program: TrueTypeFont,
    readonly resourceName: string,
    private readonly file: Uint8Array | PdfRef,
  ) {
    this.scale = 1000 / program.unitsPerEm
    this.ascent = program.ascent * this.scale
    this.descent = program.descent * this.scale
  }

  private glyph(character: string): number {
    return this.program.glyphFor(character.codePointAt(0)!)
  }

  covers(text: string): boolean {
    return [...text].every((character) => {
      if (LINE_BREAK.test(character)) return true
      const glyph = this.glyph(character)
      return glyph !== 0 && (WHITESPACE.test(character) || this.program.hasOutline(glyph))
    })
  }

  width(text: string): number {
    let total = 0
    for (const character of text) {
      if (!LINE_BREAK.test(character)) total += this.program.advance(this.glyph(character)) * this.scale
    }
    return total
  }

  encode(text: string): string {
    let hex = ''
    for (const character of text) {
      if (LINE_BREAK.test(character)) continue
      const glyph = this.glyph(character)
      if (!this.used.has(glyph)) this.used.set(glyph, character)
      hex += hex4(glyph)
    }
    return `<${hex}>`
  }

  reference(): PdfRef {
    if (this.font) return this.font
    const { program, model } = this
    const fontFile = this.file instanceof Uint8Array
      ? model.addObject({
          kind: 'dict',
          entries: new Map<string, PdfValue>([
            ['Filter', { kind: 'name', value: 'FlateDecode' }],
            ['Length1', this.file.length],
          ]),
        }, zlibSync(this.file))
      : this.file
    const name = { kind: 'name' as const, value: program.postScriptName }
    const descriptor = model.addObject({
      kind: 'dict',
      entries: new Map<string, PdfValue>([
        ['Type', { kind: 'name', value: 'FontDescriptor' }],
        ['FontName', name],
        // Symbolic: the glyphs are addressed by index, not by a standard encoding.
        ['Flags', 4 | (program.fixedPitch ? 1 : 0)],
        ['FontBBox', program.bbox.map((value) => Math.round(value * this.scale))],
        ['ItalicAngle', program.italicAngle],
        ['Ascent', Math.round(this.ascent)],
        ['Descent', Math.round(this.descent)],
        ['CapHeight', Math.round(program.capHeight * this.scale)],
        ['StemV', 80],
        ['FontFile2', fontFile],
      ]),
    })
    this.descendant = {
      kind: 'dict',
      entries: new Map<string, PdfValue>([
        ['Type', { kind: 'name', value: 'Font' }],
        ['Subtype', { kind: 'name', value: 'CIDFontType2' }],
        ['BaseFont', name],
        ['CIDSystemInfo', {
          kind: 'dict',
          entries: new Map<string, PdfValue>([['Registry', 'Adobe'], ['Ordering', 'Identity'], ['Supplement', 0]]),
        }],
        ['FontDescriptor', descriptor],
        ['CIDToGIDMap', { kind: 'name', value: 'Identity' }],
        ['DW', Math.round(program.advance(0) * this.scale)],
      ]),
    }
    this.type0 = {
      kind: 'dict',
      entries: new Map<string, PdfValue>([
        ['Type', { kind: 'name', value: 'Font' }],
        ['Subtype', { kind: 'name', value: 'Type0' }],
        ['BaseFont', name],
        ['Encoding', { kind: 'name', value: 'Identity-H' }],
        ['DescendantFonts', [model.addObject(this.descendant)]],
      ]),
    }
    this.font = model.addObject(this.type0)
    return this.font
  }

  finish(): void {
    if (!this.descendant || !this.type0) return
    const glyphs = [...this.used.keys()].sort((left, right) => left - right)
    this.descendant.entries.set('W', glyphs.flatMap((glyph) => [
      glyph,
      [Math.round(this.program.advance(glyph) * this.scale)],
    ]))
    const entries = glyphs.map((glyph) => {
      const text = this.used.get(glyph)!
      let units = ''
      for (let index = 0; index < text.length; index++) units += hex4(text.charCodeAt(index))
      return `<${hex4(glyph)}> <${units}>`
    })
    const blocks: string[] = []
    for (let start = 0; start < entries.length; start += 100) {
      const block = entries.slice(start, start + 100)
      blocks.push(`${block.length} beginbfchar\n${block.join('\n')}\nendbfchar`)
    }
    const cmap = [
      '/CIDInit /ProcSet findresource begin',
      '12 dict begin',
      'begincmap',
      '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
      '/CMapName /Adobe-Identity-UCS def',
      '/CMapType 2 def',
      '1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange',
      ...blocks,
      'endcmap',
      'CMapName currentdict /CMap defineresource pop',
      'end',
      'end',
    ].join('\n')
    this.type0.entries.set('ToUnicode', this.model.addObject({ kind: 'dict', entries: new Map() }, new TextEncoder().encode(cmap)))
  }
}

function parseSupplied(font: PdfFont): TrueTypeFont {
  try {
    return parseTrueType(font.bytes)
  } catch (error) {
    if (error instanceof FontProgramError) throw new PdfFontError(font.source, error.problem, error.message)
    throw error
  }
}

/** The embedded TrueType program behind a form font dictionary, when it has one. */
async function formFontProgram(model: PdfModel, font: PdfDict): Promise<{ program: TrueTypeFont; file: PdfRef } | undefined> {
  const subtype = model.resolve(font.entries.get('Subtype'))
  let described: PdfDict | undefined = font
  if (isName(subtype) && subtype.value === 'Type0') {
    const descendants = model.resolve(font.entries.get('DescendantFonts'))
    described = Array.isArray(descendants) ? model.dict(descendants[0]) : undefined
  }
  const descriptor = model.dict(described?.entries.get('FontDescriptor'))
  const file = descriptor?.entries.get('FontFile2')
  const record = model.record(file)
  if (!isRef(file) || !record?.stream || !model.dict(file)) return undefined
  try {
    return { program: parseTrueType(await decodeStream(model, model.dict(file)!, record.stream)), file }
  } catch {
    // A form font this renderer cannot read, such as a subset without a
    // character map, is simply not a candidate.
    return undefined
  }
}

/** Options that decide which fonts a render may draw with. */
export interface PdfFontOptions {
  /** A font supplied at render time; it wins over every other source. */
  font?: PdfFont
  /** The font the artifact's PDF layer declares. */
  layerFont?: PdfFont
}

/**
 * The fonts one render may draw with, chosen per value in order: the
 * render-time font, the layer's declared font, the form's own embedded font for
 * the field, then standard Helvetica for WinAnsi text.
 */
export class PdfFontSet {
  private readonly helvetica: StandardHelvetica
  private readonly supplied: EmbeddedTrueType[]
  private readonly formFonts = new Map<string, EmbeddedTrueType>()
  private readonly drawn = new Set<CandidateFont>()

  private constructor(private readonly model: PdfModel, supplied: EmbeddedTrueType[]) {
    this.helvetica = new StandardHelvetica(model)
    this.supplied = supplied
  }

  /** Read the supplied fonts, failing now, naming its source, on one that cannot be used. */
  static create(model: PdfModel, options: PdfFontOptions = {}): PdfFontSet {
    return new PdfFontSet(model, [
      options.font && new EmbeddedTrueType(model, parseSupplied(options.font), 'PdrFontOverride', options.font.bytes),
      options.layerFont && new EmbeddedTrueType(model, parseSupplied(options.layerFont), 'PdrFontLayer', options.layerFont.bytes),
    ].filter((font): font is EmbeddedTrueType => font !== undefined))
  }

  /** Read the embedded TrueType fonts in the form's default resources (`/DR`). */
  async readFormFonts(resources: PdfDict | undefined): Promise<void> {
    const fonts = this.model.dict(resources?.entries.get('Font'))
    for (const [name, value] of fonts?.entries ?? []) {
      const dict = this.model.dict(value)
      const found = dict ? await formFontProgram(this.model, dict) : undefined
      if (found) {
        this.formFonts.set(name, new EmbeddedTrueType(this.model, found.program, `PdrFontForm${this.formFonts.size}`, found.file))
      }
    }
  }

  /**
   * The first font that can draw every character of `text`.
   *
   * @param subject - The field or overlay, named in errors.
   * @param formFont - The form font resource the field's appearance names.
   * @throws {PdfFieldFillError} for a script that needs shaping, or a character no font can draw.
   */
  select(subject: string, text: string, formFont?: string): DrawingFont & Pick<CandidateFont, 'covers' | 'reference'> {
    for (const { script, pattern } of SHAPED_SCRIPTS) {
      if (pattern.test(text)) {
        throw new PdfFieldFillError(
          subject,
          'unsupported-script',
          { script },
          `the value contains ${script} script, which needs glyph shaping that PDF form filling and overlays do not do. ` +
            'Render documents in this script from a React composition layer.',
        )
      }
    }
    const own = formFont === undefined ? undefined : this.formFonts.get(formFont)
    const candidates: CandidateFont[] = [...this.supplied, ...(own ? [own] : []), this.helvetica]
    const chosen = candidates.find((font) => font.covers(text))
    if (chosen) {
      this.drawn.add(chosen)
      return chosen
    }
    const characters = [...text].filter((character) => !LINE_BREAK.test(character))
    const uncovered = characters.find((item) => candidates.every((font) => !font.covers(item)))
    const character = uncovered ?? characters.find((item) => !candidates[0]!.covers(item))!
    const code = `U+${hex4(character.codePointAt(0)!)}`
    throw new PdfFieldFillError(
      subject,
      'missing-glyph',
      { character },
      (uncovered
        ? `no available font can draw "${character}" (${code}).`
        : `no single available font can draw every character of the value; the first font lacks "${character}" (${code}).`) +
        ' Declare a font that covers the value on the PDF layer, or supply one at render time.',
    )
  }

  /** Write widths and Unicode maps for every embedded font this render drew with. */
  finish(): void {
    for (const font of this.drawn) font.finish()
  }
}
