export interface PdfName { kind: 'name'; value: string }
export interface PdfRef { kind: 'ref'; object: number; generation: number }
export interface PdfDict { kind: 'dict'; entries: Map<string, PdfValue> }
export type PdfValue = null | boolean | number | string | PdfName | PdfRef | PdfDict | PdfValue[]

export interface PdfObject {
  object: number
  generation: number
  value: PdfValue
  stream?: Uint8Array
}

const decoder = new TextDecoder('latin1')

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
          result += String.fromCharCode(Number.parseInt(octal, 8))
        } else result += escaped
      } else if (char === '(') {
        depth++
        result += char
      } else if (char === ')') {
        depth--
        if (depth > 0) result += char
      } else result += char
    }
    return decodePdfString(result)
  }

  private hexString(): string {
    this.position++
    const start = this.position
    while (this.position < this.source.length && this.source[this.position] !== '>') this.position++
    let hex = this.source.slice(start, this.position++).replace(/\s/g, '')
    if (hex.length % 2 === 1) hex += '0'
    const bytes = new Uint8Array(hex.length / 2)
    for (let index = 0; index < bytes.length; index++) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
    return decodePdfString(decoder.decode(bytes))
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

function decodePdfString(value: string): string {
  if (value.length >= 2 && value.charCodeAt(0) === 0xfe && value.charCodeAt(1) === 0xff) {
    let result = ''
    for (let index = 2; index + 1 < value.length; index += 2) {
      result += String.fromCharCode((value.charCodeAt(index) << 8) | value.charCodeAt(index + 1))
    }
    return result
  }
  return value
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new Error('FlateDecode is unavailable in this runtime')
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export class PdfModel {
  private readonly updated = new Set<number>()

  private constructor(
    readonly bytes: Uint8Array,
    readonly objects: Map<number, PdfObject>,
  ) {}

  static async load(bytes: Uint8Array): Promise<PdfModel> {
    const source = decoder.decode(bytes)
    const objects = new Map<number, PdfObject>()
    const indirectLengths: { object: number; start: number; length: PdfRef }[] = []
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

    const model = new PdfModel(bytes, objects)
    await model.expandObjectStreams()
    return model
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
    const object = Math.max(0, ...this.objects.keys()) + 1
    this.objects.set(object, { object, generation: 0, value, stream })
    this.updated.add(object)
    return { kind: 'ref', object, generation: 0 }
  }

  save(): Uint8Array {
    if (this.updated.size === 0) return this.bytes.slice()
    const chunks: Uint8Array[] = [this.bytes, encodeLatin1(this.bytes.at(-1) === 0x0a ? '' : '\n')]
    let offset = chunks.reduce((total, chunk) => total + chunk.length, 0)
    const offsets = new Map<number, number>()
    const records = [...this.updated]
      .map((object) => this.objects.get(object))
      .filter((record): record is PdfObject => record !== undefined)
      .sort((a, b) => a.object - b.object)

    for (const record of records) {
      offsets.set(record.object, offset)
      const header = encodeLatin1(`${record.object} ${record.generation} obj\n`)
      chunks.push(header)
      offset += header.length
      if (record.stream) {
        if (!isDict(record.value)) throw new Error(`PDF stream object ${record.object} must contain a dictionary`)
        const entries = new Map(record.value.entries)
        entries.set('Length', record.stream.length)
        const dictionary = encodeLatin1(`${serializePdfValue({ kind: 'dict', entries })}\nstream\n`)
        const footer = encodeLatin1('\nendstream\nendobj\n')
        chunks.push(dictionary, record.stream, footer)
        offset += dictionary.length + record.stream.length + footer.length
      } else {
        const body = encodeLatin1(`${serializePdfValue(record.value)}\nendobj\n`)
        chunks.push(body)
        offset += body.length
      }
    }

    const xrefOffset = offset
    let xref = 'xref\n'
    for (const record of records) {
      xref += `${record.object} 1\n${String(offsets.get(record.object)).padStart(10, '0')} ${String(record.generation).padStart(5, '0')} n \n`
    }
    const root = [...this.objects.values()].find((record) => {
      if (!isDict(record.value)) return false
      const type = record.value.entries.get('Type')
      return isName(type) && type.value === 'Catalog'
    })
    if (!root) throw new Error('PDF catalog not found')
    const previous = previousXref(this.bytes)
    const size = Math.max(...this.objects.keys()) + 1
    xref += `trailer\n<< /Size ${size} /Root ${root.object} ${root.generation} R${previous === undefined ? '' : ` /Prev ${previous}`} >>\n`
    xref += `startxref\n${xrefOffset}\n%%EOF\n`
    chunks.push(encodeLatin1(xref))

    const length = chunks.reduce((total, chunk) => total + chunk.length, 0)
    const output = new Uint8Array(length)
    let cursor = 0
    for (const chunk of chunks) {
      output.set(chunk, cursor)
      cursor += chunk.length
    }
    return output
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
      const content = decoder.decode(inflated)
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

function encodeLatin1(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length)
  for (let index = 0; index < value.length; index++) bytes[index] = value.charCodeAt(index) & 0xff
  return bytes
}

function previousXref(bytes: Uint8Array): number | undefined {
  const tail = decoder.decode(bytes.slice(Math.max(0, bytes.length - 2048)))
  const matches = [...tail.matchAll(/startxref\s+(\d+)/g)]
  const value = matches.at(-1)?.[1]
  return value ? Number(value) : undefined
}

function serializeName(value: string): string {
  return `/${value.replace(/[^!-'*-.0-;=?-Z\\^-z|~]/g, (char) => `#${char.charCodeAt(0).toString(16).padStart(2, '0')}`)}`
}

function serializeString(value: string): string {
  if ([...value].some((char) => char.charCodeAt(0) > 0xff)) {
    let hex = 'feff'
    for (const char of value) hex += char.charCodeAt(0).toString(16).padStart(4, '0')
    return `<${hex}>`
  }
  return `(${value.replace(/([\\()])/g, '\\$1').replace(/\r/g, '\\r').replace(/\n/g, '\\n')})`
}

export function serializePdfValue(value: PdfValue): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  if (typeof value === 'string') return serializeString(value)
  if (Array.isArray(value)) return `[${value.map(serializePdfValue).join(' ')}]`
  if (isName(value)) return serializeName(value.value)
  if (isRef(value)) return `${value.object} ${value.generation} R`
  return `<<${[...value.entries].map(([key, item]) => ` ${serializeName(key)} ${serializePdfValue(item)}`).join('')} >>`
}
