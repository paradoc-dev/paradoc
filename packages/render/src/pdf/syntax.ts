import { byteString } from './text-string'
import { appendPdfUpdate } from './writer'

export interface PdfName { kind: 'name'; value: string }
export interface PdfRef { kind: 'ref'; object: number; generation: number }
export interface PdfDict { kind: 'dict'; entries: Map<string, PdfValue> }
/**
 * A PDF object. A `string` is a byte string, one character per byte
 * (U+0000 to U+00FF); text entries are decoded and encoded with
 * `decodeTextString` and `encodeTextString` from `./text-string`.
 */
export type PdfValue = null | boolean | number | string | PdfName | PdfRef | PdfDict | PdfValue[]

export interface PdfObject {
  object: number
  generation: number
  value: PdfValue
  stream?: Uint8Array
}


export const isName = (value: PdfValue | undefined): value is PdfName =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value) && value.kind === 'name')
export const isRef = (value: PdfValue | undefined): value is PdfRef =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value) && value.kind === 'ref')
export const isDict = (value: PdfValue | undefined): value is PdfDict =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value) && value.kind === 'dict')

class Parser {
  constructor(
    private readonly source: string,
    private position = 0,
  ) {}

  get offset(): number { return this.position }

  parse(): PdfValue {
    this.skip()
    if (this.source.startsWith('<<', this.position)) return this.dictionary()
    const char = this.source[this.position]
    if (char === '[') return this.array()
    if (char === '/') return this.name()
    if (char === '(') return this.literalString()
    if (char === '<') return this.hexString()
    if (this.source.startsWith('true', this.position)) { this.position += 4; return true }
    if (this.source.startsWith('false', this.position)) { this.position += 5; return false }
    if (this.source.startsWith('null', this.position)) { this.position += 4; return null }
    return this.numberOrRef()
  }

  private dictionary(): PdfDict {
    this.position += 2
    const entries = new Map<string, PdfValue>()
    while (true) {
      this.skip()
      this.assertNotAtEnd()
      if (this.source.startsWith('>>', this.position)) {
        this.position += 2
        return { kind: 'dict', entries }
      }
      const key = this.name().value
      entries.set(key, this.parse())
    }
  }

  private array(): PdfValue[] {
    this.position++
    const values: PdfValue[] = []
    while (true) {
      this.skip()
      this.assertNotAtEnd()
      if (this.source[this.position] === ']') {
        this.position++
        return values
      }
      values.push(this.parse())
    }
  }

  private name(): PdfName {
    this.position++
    const start = this.position
    while (!this.atDelimiter()) this.position++
    return {
      kind: 'name',
      value: this.source.slice(start, this.position).replace(/#([0-9a-f]{2})/gi, (_, hex: string) =>
        String.fromCharCode(Number.parseInt(hex, 16))),
    }
  }

  private literalString(): string {
    this.position++
    let depth = 1
    let result = ''
    while (this.position < this.source.length && depth > 0) {
      const char = this.source[this.position++]!
      if (char === '\\') {
        const escaped = this.source[this.position++]
        if (escaped === undefined) break
        const simple: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' }
        if (simple[escaped]) result += simple[escaped]
        else if (escaped === '\n') continue
        else if (escaped === '\r') {
          if (this.source[this.position] === '\n') this.position++
        } else if (/[0-7]/.test(escaped)) {
          let octal = escaped
          while (octal.length < 3 && /[0-7]/.test(this.source[this.position] ?? '')) octal += this.source[this.position++]
          result += String.fromCharCode(Number.parseInt(octal, 8) & 0xff)
        } else result += escaped
      } else if (char === '(') {
        depth++
        result += char
      } else if (char === ')') {
        depth--
        if (depth > 0) result += char
      } else result += char
    }
    return result
  }

  private hexString(): string {
    this.position++
    const start = this.position
    while (this.position < this.source.length && this.source[this.position] !== '>') this.position++
    let hex = this.source.slice(start, this.position++).replace(/\s/g, '')
    if (hex.length % 2 === 1) hex += '0'
    const bytes = new Uint8Array(hex.length / 2)
    for (let index = 0; index < bytes.length; index++) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
    return byteString(bytes)
  }

  private numberOrRef(): number | PdfRef {
    const first = this.number()
    const saved = this.position
    this.skip()
    if (/[-+\d.]/.test(this.source[this.position] ?? '')) {
      const second = this.number()
      this.skip()
      if (this.source[this.position] === 'R' && Number.isInteger(first) && Number.isInteger(second)) {
        this.position++
        return { kind: 'ref', object: first, generation: second }
      }
    }
    this.position = saved
    return first
  }

  private number(): number {
    const start = this.position
    while (/[-+\d.]/.test(this.source[this.position] ?? '')) this.position++
    const value = Number(this.source.slice(start, this.position))
    if (!Number.isFinite(value)) throw new Error(`Invalid PDF number at byte ${start}`)
    return value
  }

  private assertNotAtEnd(): void {
    if (this.position >= this.source.length) throw new Error('Unexpected end of PDF data')
  }

  private skip(): void {
    while (this.position < this.source.length) {
      if (/\s|\0/.test(this.source[this.position]!)) this.position++
      else if (this.source[this.position] === '%') {
        while (this.position < this.source.length && !/[\r\n]/.test(this.source[this.position]!)) this.position++
      } else break
    }
  }

  private atDelimiter(): boolean {
    const char = this.source[this.position]
    return char === undefined || /\s/.test(char) || ['(', ')', '<', '>', '[', ']', '{', '}', '/', '%'].includes(char)
  }
}

/** Inflate a FlateDecode stream. */
export async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new Error('FlateDecode is unavailable in this runtime')
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/**
 * Thrown by every entry point that parses or writes a PDF when the file is
 * encrypted.
 *
 * An encrypted file stores its strings and streams enciphered under a key
 * derived from the file itself. Field names read as ciphertext, values written
 * in plaintext would not decrypt, and copied streams would be garbage, so an
 * encrypted file is refused rather than read wrongly.
 */
export class PdfEncryptedError extends Error {
  readonly code = 'encrypted_pdf' as const

  constructor() {
    super('The PDF is encrypted. Paradoc reads and writes unencrypted PDFs only; remove the encryption and try again.')
    this.name = 'PdfEncryptedError'
  }
}

/** Trailer keys that describe one cross-reference section rather than the document. */
const SECTION_KEYS = ['Size', 'Prev', 'XRefStm', 'Type', 'Index', 'W', 'Length', 'Filter', 'DecodeParms'] as const

const isXrefStream = (value: PdfValue | undefined): value is PdfDict => {
  if (!isDict(value)) return false
  const type = value.entries.get('Type')
  return isName(type) && type.value === 'XRef'
}

/**
 * Every classic `trailer` dictionary in the file, in file order. The keyword
 * inside an object's body (a string, a content stream) is not a trailer.
 */
function trailerDictionaries(source: string, bodies: readonly [number, number][]): { offset: number; dict: PdfDict }[] {
  const trailers: { offset: number; dict: PdfDict }[] = []
  for (const match of source.matchAll(/trailer\s*<</g)) {
    const at = match.index ?? 0
    if (bodies.some(([start, end]) => at >= start && at < end)) continue
    try {
      const value = new Parser(source, at + 'trailer'.length).parse()
      if (isDict(value)) trailers.push({ offset: at, dict: value })
    } catch {
      // "trailer" inside a stream's bytes is not a trailer.
    }
  }
  return trailers
}

/**
 * The newest trailer: the one the last `startxref` points at, either a classic
 * table's trailer or a cross-reference stream's dictionary. A file whose last
 * `startxref` is wrong falls back to its last trailer, as readers do.
 */
function newestTrailer(
  source: string,
  startxref: number | undefined,
  trailers: readonly { offset: number; dict: PdfDict }[],
  objects: ReadonlyMap<number, PdfObject>,
): PdfDict | undefined {
  if (startxref !== undefined) {
    if (/^\s*xref\b/.test(source.slice(startxref, startxref + 16))) {
      const trailer = trailers.find(({ offset }) => offset > startxref)
      if (trailer) return trailer.dict
    }
    const header = /^\s*(\d+)\s+\d+\s+obj\b/.exec(source.slice(startxref, startxref + 32))
    const stream = header ? objects.get(Number(header[1]))?.value : undefined
    if (isXrefStream(stream)) return stream
  }
  if (trailers.length > 0) return trailers.at(-1)!.dict
  return [...objects.values()].map(({ value }) => value).filter(isXrefStream).at(-1)
}

export class PdfModel {
  private readonly updated = new Set<number>()

  private constructor(
    readonly bytes: Uint8Array,
    readonly objects: Map<number, PdfObject>,
    /** The newest trailer, or an empty dictionary when the file has none. */
    readonly trailer: PdfDict,
    /** Offset of the newest cross-reference section. */
    private readonly startxref: number | undefined,
  ) {}

  static async load(bytes: Uint8Array): Promise<PdfModel> {
    const source = byteString(bytes)
    const objects = new Map<number, PdfObject>()
    const indirectLengths: { object: number; start: number; length: PdfRef }[] = []
    /** Where each object's body lies, so a keyword inside one is not read as file structure. */
    const bodies: [number, number][] = []
    const pattern = /(?:^|[\r\n])\s*(\d+)\s+(\d+)\s+obj\b/g
    for (const match of source.matchAll(pattern)) {
      const object = Number(match[1])
      const generation = Number(match[2])
      const valueOffset = (match.index ?? 0) + match[0].length
      try {
        const parser = new Parser(source, valueOffset)
        const value = parser.parse()
        const after = parser.offset
        const streamMatch = source.slice(after, after + 32).match(/^\s*stream\r?\n/)
        let stream: Uint8Array | undefined
        if (streamMatch) {
          const start = after + streamMatch[0].length
          const declaredLength = isDict(value) ? value.entries.get('Length') : undefined
          if (typeof declaredLength === 'number') {
            stream = bytes.slice(start, start + declaredLength)
          } else {
            if (isRef(declaredLength)) indirectLengths.push({ object, start, length: declaredLength })
            let end = source.indexOf('endstream', start)
            if (end !== -1) {
              if (bytes[end - 1] === 0x0a) end--
              if (bytes[end - 1] === 0x0d) end--
              stream = bytes.slice(start, end)
            }
          }
        }
        objects.set(object, { object, generation, value, stream })
        bodies.push([valueOffset, streamMatch ? after + streamMatch[0].length + (stream?.length ?? 0) : after])
      } catch {
        // Byte patterns inside compressed streams can resemble object headers.
      }
    }

    // An indirect /Length can only be resolved once every object is parsed;
    // re-slice those streams exactly, since the endstream fallback can trim
    // trailing bytes that belong to the compressed data.
    for (const pending of indirectLengths) {
      const length = objects.get(pending.length.object)?.value
      const record = objects.get(pending.object)
      if (typeof length === 'number' && record) {
        record.stream = bytes.slice(pending.start, pending.start + length)
      }
    }

    // The check runs before object streams are expanded: an encrypted file's
    // object streams are enciphered, and inflating them fails obscurely.
    const trailers = trailerDictionaries(source, bodies)
    if (
      trailers.some(({ dict }) => dict.entries.has('Encrypt'))
      || [...objects.values()].some(({ value }) => isXrefStream(value) && value.entries.has('Encrypt'))
    ) {
      throw new PdfEncryptedError()
    }

    const startxref = lastStartxref(source)
    const trailer = newestTrailer(source, startxref, trailers, objects) ?? { kind: 'dict', entries: new Map() }
    const model = new PdfModel(bytes, objects, trailer, startxref)
    await model.expandObjectStreams()
    return model
  }

  /**
   * The document catalog: the object the newest trailer's `/Root` names. A file
   * with no readable trailer falls back to the first object typed `Catalog`.
   */
  catalog(): PdfObject | undefined {
    const root = this.trailer.entries.get('Root')
    if (isRef(root)) {
      const record = this.objects.get(root.object)
      if (!record || !isDict(record.value)) return undefined
      const type = record.value.entries.get('Type')
      return type === undefined || (isName(type) && type.value === 'Catalog') ? record : undefined
    }
    return [...this.objects.values()].find((record) => {
      if (!isDict(record.value)) return false
      const type = record.value.entries.get('Type')
      return isName(type) && type.value === 'Catalog'
    })
  }

  resolve(value: PdfValue | undefined): PdfValue | undefined {
    return isRef(value) ? this.objects.get(value.object)?.value : value
  }

  dict(value: PdfValue | undefined): PdfDict | undefined {
    const resolved = this.resolve(value)
    return isDict(resolved) ? resolved : undefined
  }

  record(value: PdfValue | undefined): PdfObject | undefined {
    return isRef(value) ? this.objects.get(value.object) : undefined
  }

  markUpdated(value: PdfRef | PdfObject | undefined): void {
    if (!value) return
    this.updated.add(value.object)
  }

  addObject(value: PdfValue, stream?: Uint8Array): PdfRef {
    const object = nextObjectNumber(this.trailer, this.objects)
    this.objects.set(object, { object, generation: 0, value, stream })
    this.updated.add(object)
    return { kind: 'ref', object, generation: 0 }
  }

  /**
   * The file with every updated object appended as an incremental update. The
   * update trailer repeats the newest trailer's document entries (`/Info`,
   * `/ID`) and points `/Root` at the catalog.
   */
  save(): Uint8Array {
    if (this.updated.size === 0) return this.bytes.slice()
    const catalog = this.catalog()
    if (!catalog) throw new Error('PDF catalog not found')
    const records = [...this.updated]
      .map((object) => this.objects.get(object))
      .filter((record): record is PdfObject => record !== undefined)
    const trailer = new Map(this.trailer.entries)
    for (const key of SECTION_KEYS) trailer.delete(key)
    trailer.set('Size', nextObjectNumber(this.trailer, this.objects))
    trailer.set('Root', { kind: 'ref', object: catalog.object, generation: catalog.generation })
    if (this.startxref !== undefined) trailer.set('Prev', this.startxref)
    return appendPdfUpdate(this.bytes, records, trailer)
  }

  private async expandObjectStreams(): Promise<void> {
    for (const record of [...this.objects.values()]) {
      if (!isDict(record.value) || !record.stream) continue
      const type = record.value.entries.get('Type')
      if (!isName(type) || type.value !== 'ObjStm') continue
      const count = record.value.entries.get('N')
      const first = record.value.entries.get('First')
      if (typeof count !== 'number' || typeof first !== 'number') continue
      const filter = record.value.entries.get('Filter')
      const inflated = isName(filter) && filter.value === 'FlateDecode' ? await inflate(record.stream) : record.stream
      const content = byteString(inflated)
      const header = content.slice(0, first).trim().split(/\s+/).map(Number)
      for (let index = 0; index < count; index++) {
        const object = header[index * 2]
        const offset = header[index * 2 + 1]
        if (!Number.isInteger(object) || !Number.isInteger(offset)) continue
        try {
          const parser = new Parser(content, first + offset!)
          if (!this.objects.has(object!)) {
            this.objects.set(object!, { object: object!, generation: 0, value: parser.parse() })
          }
        } catch {
          // A malformed member should not hide other readable AcroForm objects.
        }
      }
    }
  }
}

function lastStartxref(source: string): number | undefined {
  const tail = source.slice(Math.max(0, source.length - 2048))
  const value = [...tail.matchAll(/startxref\s+(\d+)/g)].at(-1)?.[1]
  return value === undefined ? undefined : Number(value)
}

/**
 * The first object number no section of the file has used: past every object
 * read, and past the newest trailer's `/Size`, which also counts free entries.
 */
function nextObjectNumber(trailer: PdfDict, objects: ReadonlyMap<number, PdfObject>): number {
  const size = trailer.entries.get('Size')
  return Math.max(typeof size === 'number' ? size : 0, Math.max(0, ...objects.keys()) + 1)
}
