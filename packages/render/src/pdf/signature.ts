/**
 * PDF signature fields: the file structure a digital signature lives in.
 *
 * A signature is an incremental update (ISO 32000-1, 12.8). The update adds a
 * signature dictionary, a signature field whose widget sits on the first page
 * and whose `/V` is that dictionary, and an AcroForm entry with `/SigFlags 3`.
 * The dictionary's `/ByteRange` covers the whole file except the `/Contents`
 * hex string, which holds the signature container.
 *
 * This module writes and reads that structure only. Producing and checking the
 * container (CMS, keys, certificates) is the caller's work: prepare the field,
 * sign the bytes its byte range covers, then embed the container.
 */

import { documentPages } from './page-tree'
import { isDict, isName, PdfModel, type PdfDict, type PdfObject, type PdfRef, type PdfValue } from './syntax'
import { byteString, decodeTextString, encodeTextString } from './text-string'
import { encodeLatin1 } from './writer'

/** What a new signature dictionary says about the signature. */
export interface PdfSignatureOptions {
  /** Bytes reserved for the signature container. The embedded container may be shorter, never longer. */
  contentsSize: number
  /** The signing time, written as `/M`. */
  signingTime: Date
  /** The signer's name, in any script (`/Name`). */
  name?: string
  /** Why the document was signed (`/Reason`). */
  reason?: string
  /** Where it was signed (`/Location`). */
  location?: string
  /** How to reach the signer (`/ContactInfo`). */
  contactInfo?: string
}

/** A PDF with a signature field whose container is still empty. */
export interface PreparedPdfSignature {
  /** The PDF, with `/ByteRange` written and `/Contents` zero-filled. */
  bytes: Uint8Array
  /** `[0, gapStart, gapEnd, length - gapEnd]`: the two ranges the signature covers. */
  byteRange: [number, number, number, number]
}

/** The newest signature in a PDF, read from its signature dictionary. */
export interface PdfSignatureRecord {
  /** The signature container, including any zero padding after it. */
  contents: Uint8Array
  /** The ranges the signature covers, as the dictionary states them. */
  byteRange: [number, number, number, number]
  /** The bytes `byteRange` covers, concatenated. */
  signedBytes: Uint8Array
  /**
   * True when the byte range starts at the first byte, ends at the last byte,
   * and leaves out exactly this dictionary's `/Contents` hex string. False when
   * any other byte is unsigned, such as an update appended after signing.
   */
  coversWholeFile: boolean
  name?: string
  reason?: string
  location?: string
  contactInfo?: string
  signingTime?: Date
}

/** Ten digits per number, so the written byte range fits where the placeholder stood. */
const BYTE_RANGE_PLACEHOLDER = 9_999_999_999
const BYTE_RANGE_TEXT = `[${Array(4).fill(BYTE_RANGE_PLACEHOLDER).join(' ')}]`

const name = (value: string): PdfValue => ({ kind: 'name', value })

function pdfDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `D:${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`
    + `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
}

function parsePdfDate(value: string): Date | undefined {
  const match = /^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?(?:([Zz+-])(\d{2})?'?(\d{2})?'?)?/.exec(value)
  if (!match) return undefined
  const [, year, month = '01', day = '01', hour = '00', minute = '00', second = '00', sign, offsetHours = '00', offsetMinutes = '00'] = match
  const utc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second))
  const offset = (Number(offsetHours) * 60 + Number(offsetMinutes)) * 60_000
  return new Date(sign === '+' ? utc - offset : sign === '-' ? utc + offset : utc)
}

/** The array a dictionary entry holds, directly or through a reference, marking its holder updated. */
function editableArray(model: PdfModel, holder: PdfObject, dict: PdfDict, key: string): PdfValue[] {
  const value = dict.entries.get(key)
  const indirect = model.record(value)
  if (indirect && Array.isArray(indirect.value)) {
    model.markUpdated(indirect)
    return indirect.value
  }
  const array = Array.isArray(value) ? value : []
  dict.entries.set(key, array)
  model.markUpdated(holder)
  return array
}

/** The AcroForm dictionary, created on the catalog when the file has none, and the object holding it. */
function editableAcroForm(model: PdfModel, catalog: PdfObject & { value: PdfDict }): { holder: PdfObject; form: PdfDict } {
  const value = catalog.value.entries.get('AcroForm')
  const indirect = model.record(value)
  if (indirect && isDict(indirect.value)) return { holder: indirect, form: indirect.value }
  const form: PdfDict = isDict(value) ? value : { kind: 'dict', entries: new Map() }
  catalog.value.entries.set('AcroForm', form)
  return { holder: catalog, form }
}

function fieldNames(model: PdfModel, fields: readonly PdfValue[]): Set<string> {
  const names = new Set<string>()
  for (const field of fields) {
    const title = model.dict(field)?.entries.get('T')
    if (typeof title === 'string') names.add(decodeTextString(title))
  }
  return names
}

function indexOf(haystack: Uint8Array, needle: string, from: number): number {
  const bytes = encodeLatin1(needle)
  outer: for (let index = from; index <= haystack.length - bytes.length; index++) {
    for (let offset = 0; offset < bytes.length; offset++) {
      if (haystack[index + offset] !== bytes[offset]) continue outer
    }
    return index
  }
  return -1
}

/**
 * `pdf` with a new, empty signature field added as an incremental update.
 *
 * The field is invisible (a zero-size widget on the first page). Its byte range
 * is final; sign `signedBytes(prepared)` and pass the container to
 * `embedPdfSignature`.
 */
export async function preparePdfSignature(pdf: Uint8Array, options: PdfSignatureOptions): Promise<PreparedPdfSignature> {
  if (!Number.isInteger(options.contentsSize) || options.contentsSize < 1) {
    throw new Error('contentsSize must be a positive whole number of bytes')
  }
  const model = await PdfModel.load(pdf)
  const catalog = model.catalog()
  if (!catalog || !isDict(catalog.value)) throw new Error('PDF catalog not found')
  const [firstPage] = documentPages(model)
  if (!firstPage || !isDict(firstPage.record.value)) throw new Error('PDF has no page to hold the signature widget')

  const signatureEntries = new Map<string, PdfValue>([
    ['Type', name('Sig')],
    ['Filter', name('Adobe.PPKLite')],
    ['SubFilter', name('adbe.pkcs7.detached')],
    ['ByteRange', Array(4).fill(BYTE_RANGE_PLACEHOLDER)],
    ['Contents', '\0'.repeat(options.contentsSize)],
    ['M', pdfDate(options.signingTime)],
  ])
  const text: [string, string | undefined][] = [
    ['Name', options.name],
    ['Reason', options.reason],
    ['Location', options.location],
    ['ContactInfo', options.contactInfo],
  ]
  for (const [key, value] of text) if (value) signatureEntries.set(key, encodeTextString(value))
  const signatureRef = model.addObject({ kind: 'dict', entries: signatureEntries })

  const { holder, form } = editableAcroForm(model, catalog as PdfObject & { value: PdfDict })
  const fields = editableArray(model, holder, form, 'Fields')
  const taken = fieldNames(model, fields)
  let ordinal = 1
  while (taken.has(`Signature${ordinal}`)) ordinal++

  const widgetRef: PdfRef = model.addObject({
    kind: 'dict',
    entries: new Map<string, PdfValue>([
      ['Type', name('Annot')],
      ['Subtype', name('Widget')],
      ['FT', name('Sig')],
      ['T', `Signature${ordinal}`],
      ['V', signatureRef],
      // Print (4) and Locked (128).
      ['F', 132],
      ['Rect', [0, 0, 0, 0]],
      ['P', firstPage.ref],
    ]),
  })
  fields.push(widgetRef)
  // SignaturesExist (1) and AppendOnly (2).
  form.entries.set('SigFlags', 3)
  model.markUpdated(holder)
  editableArray(model, firstPage.record, firstPage.record.value, 'Annots').push(widgetRef)

  const bytes = model.save()
  const objectStart = indexOf(bytes, `\n${signatureRef.object} 0 obj\n`, pdf.length - 1)
  if (objectStart === -1) throw new Error('Signature dictionary not found in the saved PDF')
  const byteRangeKey = indexOf(bytes, `/ByteRange ${BYTE_RANGE_TEXT}`, objectStart)
  const contentsKey = indexOf(bytes, '/Contents <', objectStart)
  if (byteRangeKey === -1 || contentsKey === -1) throw new Error('Signature placeholders not found in the saved PDF')
  const byteRangeAt = byteRangeKey + '/ByteRange '.length
  const contentsAt = contentsKey + '/Contents '.length
  const gapEnd = contentsAt + options.contentsSize * 2 + 2
  const byteRange: [number, number, number, number] = [0, contentsAt, gapEnd, bytes.length - gapEnd]
  const written = `[${byteRange.join(' ')}`
  bytes.set(encodeLatin1(`${written}${' '.repeat(BYTE_RANGE_TEXT.length - written.length - 1)}]`), byteRangeAt)
  return { bytes, byteRange }
}

/** The bytes a prepared signature covers: what the signature container signs. */
export function signedBytes(prepared: PreparedPdfSignature): Uint8Array {
  const [start, length, gapEnd, rest] = prepared.byteRange
  const output = new Uint8Array(length + rest)
  output.set(prepared.bytes.subarray(start, start + length), 0)
  output.set(prepared.bytes.subarray(gapEnd, gapEnd + rest), length)
  return output
}

/** The prepared PDF with `container` written into its `/Contents`. */
export function embedPdfSignature(prepared: PreparedPdfSignature, container: Uint8Array): Uint8Array {
  const [, gapStart, gapEnd] = prepared.byteRange
  const capacity = (gapEnd - gapStart - 2) / 2
  if (container.length > capacity) {
    throw new Error(`Signature container is ${container.length} bytes; the field reserves ${capacity}`)
  }
  let hex = ''
  for (const byte of container) hex += byte.toString(16).padStart(2, '0')
  const output = prepared.bytes.slice()
  output.set(encodeLatin1(hex.padEnd(capacity * 2, '0')), gapStart + 1)
  return output
}

function isSignatureDictionary(value: PdfValue | undefined): value is PdfDict {
  if (!isDict(value)) return false
  const type = value.entries.get('Type')
  const byteRange = value.entries.get('ByteRange')
  return (type === undefined || (isName(type) && (type.value === 'Sig' || type.value === 'DocTimeStamp')))
    && Array.isArray(byteRange)
    && byteRange.length === 4
    && byteRange.every((entry) => typeof entry === 'number' && Number.isInteger(entry) && entry >= 0)
    && typeof value.entries.get('Contents') === 'string'
}

function textEntry(dict: PdfDict, key: string): string | undefined {
  const value = dict.entries.get(key)
  return typeof value === 'string' ? decodeTextString(value) : undefined
}

/**
 * The newest signature in `pdf`: the signature dictionary whose byte range
 * reaches furthest into the file. Every value comes from that dictionary, so
 * other objects (an annotation's `/Contents`, a field's `/Name`) never stand in
 * for it. Returns `undefined` when the file holds no signature.
 */
export async function readPdfSignature(pdf: Uint8Array): Promise<PdfSignatureRecord | undefined> {
  const model = await PdfModel.load(pdf)
  let newest: PdfDict | undefined
  let newestEnd = -1
  for (const record of model.objects.values()) {
    if (!isSignatureDictionary(record.value)) continue
    const [, , offset, length] = record.value.entries.get('ByteRange') as number[]
    if (offset! + length! > newestEnd) {
      newest = record.value
      newestEnd = offset! + length!
    }
  }
  if (!newest) return undefined

  const byteRange = newest.entries.get('ByteRange') as [number, number, number, number]
  const contents = encodeLatin1(newest.entries.get('Contents') as string)
  const [start, length, gapEnd, rest] = byteRange
  const inFile = start + length <= gapEnd && gapEnd + rest <= pdf.length
  const signed = new Uint8Array(inFile ? length + rest : 0)
  if (inFile) {
    signed.set(pdf.subarray(start, start + length), 0)
    signed.set(pdf.subarray(gapEnd, gapEnd + rest), length)
  }
  const gap = byteString(pdf.subarray(start + length, gapEnd))
  const gapHex = /^<([0-9A-Fa-f]*)>$/.exec(gap)?.[1]
  const gapIsContents = gapHex !== undefined
    && gapHex.length === contents.length * 2
    && contents.every((byte, index) => Number.parseInt(gapHex.slice(index * 2, index * 2 + 2), 16) === byte)

  const signingTime = newest.entries.get('M')
  return {
    contents,
    byteRange,
    signedBytes: signed,
    coversWholeFile: inFile && start === 0 && gapEnd + rest === pdf.length && gapIsContents,
    name: textEntry(newest, 'Name'),
    reason: textEntry(newest, 'Reason'),
    location: textEntry(newest, 'Location'),
    contactInfo: textEntry(newest, 'ContactInfo'),
    signingTime: typeof signingTime === 'string' ? parsePdfDate(signingTime) : undefined,
  }
}
