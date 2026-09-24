/**
 * The one PDF writer.
 *
 * A PDF leaves this package in one of two ways. An incremental update appends
 * the changed objects and a new cross-reference section to the original bytes,
 * which is how filling, flattening and overlays save. A fresh document holds
 * only the objects it names, which is how merging and page selection save,
 * because neither may carry anything the result does not reach. Both write
 * objects through the same serializer.
 *
 * This module depends on the object model's types only, so the model can save
 * through it without an import cycle.
 */

import type { PdfDict, PdfModel, PdfObject, PdfValue } from './syntax'

/** Latin-1 bytes for a PDF token or dictionary, which is how a PDF file is written. */
export function encodeLatin1(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length)
  for (let index = 0; index < value.length; index++) bytes[index] = value.charCodeAt(index) & 0xff
  return bytes
}

function serializeName(value: string): string {
  return `/${value.replace(/[^!-'*-.0-;=?-Z\\^-z|~]/g, (char) => `#${char.charCodeAt(0).toString(16).padStart(2, '0')}`)}`
}

function serializeString(value: string): string {
  let hex = ''
  let printable = true
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code > 0xff) throw new Error(`PDF string holds U+${code.toString(16).toUpperCase().padStart(4, '0')}; encode text with encodeTextString before storing it`)
    if (code < 0x20 ? code !== 0x09 && code !== 0x0a && code !== 0x0d : code > 0x7e) printable = false
    hex += code.toString(16).padStart(2, '0')
  }
  if (!printable) return `<${hex}>`
  return `(${value.replace(/([\\()])/g, '\\$1').replace(/\r/g, '\\r').replace(/\n/g, '\\n')})`
}

export function serializePdfValue(value: PdfValue): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  if (typeof value === 'string') return serializeString(value)
  if (Array.isArray(value)) return `[${value.map(serializePdfValue).join(' ')}]`
  if (value.kind === 'name') return serializeName(value.value)
  if (value.kind === 'ref') return `${value.object} ${value.generation} R`
  return `<<${[...value.entries].map(([key, item]) => ` ${serializeName(key)} ${serializePdfValue(item)}`).join('')} >>`
}

/** Serialized objects, and the byte offset each one starts at. */
interface Body {
  chunks: Uint8Array[]
  offsets: Map<number, number>
  end: number
}

function serializeObjects(objects: readonly PdfObject[], start: number): Body {
  const chunks: Uint8Array[] = []
  const offsets = new Map<number, number>()
  let offset = start
  for (const record of [...objects].sort((a, b) => a.object - b.object)) {
    offsets.set(record.object, offset)
    const header = encodeLatin1(`${record.object} ${record.generation} obj\n`)
    chunks.push(header)
    offset += header.length
    if (record.stream) {
      if (typeof record.value !== 'object' || record.value === null || Array.isArray(record.value) || record.value.kind !== 'dict') {
        throw new Error(`PDF stream object ${record.object} must contain a dictionary`)
      }
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
  return { chunks, offsets, end: offset }
}

function trailerSection(trailer: ReadonlyMap<string, PdfValue>, xrefOffset: number): string {
  return `trailer\n${serializePdfValue({ kind: 'dict', entries: new Map(trailer) })}\nstartxref\n${xrefOffset}\n%%EOF\n`
}

function concat(chunks: readonly Uint8Array[]): Uint8Array {
  const output = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0))
  let cursor = 0
  for (const chunk of chunks) {
    output.set(chunk, cursor)
    cursor += chunk.length
  }
  return output
}

/**
 * A complete PDF holding exactly `objects`, with a classic cross-reference
 * table. `trailer` supplies `/Root` and any `/Info` or `/ID`; `/Size` is
 * computed here.
 */
export function writePdf(objects: readonly PdfObject[], trailer: ReadonlyMap<string, PdfValue>): Uint8Array {
  const header = encodeLatin1('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n')
  const body = serializeObjects(objects, header.length)
  const size = objects.reduce((highest, record) => Math.max(highest, record.object), 0) + 1
  let table = `xref\n0 ${size}\n0000000000 65535 f \n`
  for (let number = 1; number < size; number++) {
    const at = body.offsets.get(number)
    table += at === undefined ? '0000000000 65535 f \n' : `${String(at).padStart(10, '0')} 00000 n \n`
  }
  const entries = new Map(trailer)
  entries.set('Size', size)
  table += trailerSection(entries, body.end)
  return concat([header, ...body.chunks, encodeLatin1(table)])
}

/**
 * `base` with `objects` appended as an incremental update.
 *
 * `trailer` is the complete update trailer, including `/Size`, `/Root` and
 * `/Prev`. An update's trailer repeats every entry of the one before it, so a
 * caller that drops `/Info`, `/ID` or `/Encrypt` changes how the file reads.
 */
export function appendPdfUpdate(
  base: Uint8Array,
  objects: readonly PdfObject[],
  trailer: ReadonlyMap<string, PdfValue>,
): Uint8Array {
  const separator = encodeLatin1(base.at(-1) === 0x0a ? '' : '\n')
  const body = serializeObjects(objects, base.length + separator.length)
  let xref = 'xref\n'
  for (const record of [...objects].sort((a, b) => a.object - b.object)) {
    xref += `${record.object} 1\n${String(body.offsets.get(record.object)).padStart(10, '0')} ${String(record.generation).padStart(5, '0')} n \n`
  }
  xref += trailerSection(trailer, body.end)
  return concat([base, separator, ...body.chunks, encodeLatin1(xref)])
}

/**
 * Every object number `value` reaches, added to `seen`. Objects in `excluded`
 * are neither added nor followed.
 */
export function collectRefs(
  model: PdfModel,
  value: PdfValue | undefined,
  seen: Set<number>,
  excluded: ReadonlySet<number> = new Set(),
): void {
  if (value === null || value === undefined || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const entry of value) collectRefs(model, entry, seen, excluded)
    return
  }
  if (value.kind === 'ref') {
    if (seen.has(value.object) || excluded.has(value.object)) return
    seen.add(value.object)
    const record = model.objects.get(value.object)
    if (record) collectRefs(model, record.value, seen, excluded)
    return
  }
  if (value.kind === 'dict') {
    for (const entry of value.entries.values()) collectRefs(model, entry, seen, excluded)
  }
}

/**
 * The same value with every reference renumbered through `mapping`.
 *
 * A reference to an object the new document does not hold is dangling. In a
 * list of references (`/Kids`, `/Annots`, `/Fields`) it is dropped; anywhere
 * else it becomes `null`, which is what a reader must make of a missing object.
 */
export function renumber(value: PdfValue, mapping: ReadonlyMap<number, number>): PdfValue {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    const references = value.length > 0 && value.every((entry) => isRefValue(entry))
    const kept = references ? value.filter((entry) => isRefValue(entry) && mapping.has(entry.object)) : value
    return kept.map((entry) => renumber(entry, mapping))
  }
  if (value.kind === 'ref') {
    const target = mapping.get(value.object)
    return target === undefined ? null : { kind: 'ref', object: target, generation: 0 }
  }
  if (value.kind === 'dict') {
    const entries = new Map<string, PdfValue>()
    for (const [key, entry] of value.entries) entries.set(key, renumber(entry, mapping))
    return { kind: 'dict', entries } satisfies PdfDict
  }
  return value
}

function isRefValue(value: PdfValue): value is Extract<PdfValue, { kind: 'ref' }> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && value.kind === 'ref'
}
