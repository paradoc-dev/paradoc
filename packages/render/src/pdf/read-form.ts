import { defaultFormatter } from '@paradoc/format'
import type { BinaryContent, EnumOption, Form, FormField, Formatter, LayerFormat } from '@paradoc/types'
import { validateFieldBindings } from '../text/field-formatter'
import { pathSegments } from '../path'
import { acroFields, type AcroField } from './acroform'
import { isDict, isName, PdfModel, type PdfValue } from './syntax'
import { byteString, decodeTextString } from './text-string'

/** Why a PDF could not be read as the artifact's filled form. */
export type PdfExtractionErrorCode =
  | 'malformed_pdf'
  | 'encrypted_pdf'
  | 'no_form_fields'
  | 'not_matching'
  | 'no_pdf_layer'
  | 'layer_required'
  | 'layer_not_found'
  | 'not_pdf_layer'

/** Extraction refused the input. `code` says which failure case applies. */
export class PdfExtractionError extends Error {
  readonly code: PdfExtractionErrorCode

  constructor(code: PdfExtractionErrorCode, message: string) {
    super(message)
    this.name = 'PdfExtractionError'
    this.code = code
  }
}

/** What happened to one artifact path the layer's bindings target. */
export type PdfExtractionStatus = 'recovered' | 'empty' | 'not_recoverable' | 'unparseable'

/** One PDF field that carries a binding target, with the raw value read from it. */
export interface PdfExtractionSource {
  /** Fully qualified AcroForm field name. */
  field: string
  /** Raw PDF value: the text, the selected option, or a button state name. Absent when the field has none. */
  value?: string
}

/** One entry per artifact path the layer's bindings target. */
export interface PdfExtractionEntry {
  /** The binding target, as written in the layer's bindings. */
  path: string
  status: PdfExtractionStatus
  /** Every PDF field that carries this path. */
  sources: PdfExtractionSource[]
  /** Why the value is not recoverable or could not be parsed. */
  reason?: string
}

/** A PDF field that holds a value no binding covers. */
export interface PdfUnboundField {
  field: string
  type: 'text' | 'checkbox' | 'radio' | 'dropdown'
  value: string
}

export interface PdfExtractionReport {
  entries: PdfExtractionEntry[]
  unbound: PdfUnboundField[]
}

/** Partial artifact data in the fill payload shape. It holds only values recovered exactly. */
export interface PdfExtractedData {
  fields: Record<string, unknown>
  parties?: Record<string, unknown>
  annexes?: Record<string, unknown>
}

export interface PdfExtraction {
  data: PdfExtractedData
  report: PdfExtractionReport
}

export interface ExtractPdfDataOptions {
  /** The filled PDF. It is read, never modified. */
  pdf: BinaryContent
  /** The artifact whose layer produced the PDF. */
  form: Form
  /** The PDF layer's bindings: AcroForm field name to artifact path. */
  bindings: Record<string, string>
  /** The formatter the PDF was filled with. Defaults to the default formatter. */
  formatter?: Formatter
  /**
   * The presentation the PDF layer declares, applied over `formatter` as it
   * was when filling. With `money.currencyDisplay: 'none'`, an amount is read
   * in the currency its field declares.
   */
  format?: LayerFormat
}

// ---------------------------------------------------------------------------
// Reading the PDF
// ---------------------------------------------------------------------------

interface FieldState {
  field: AcroField
  /** Raw text for text and dropdown fields, the state name for buttons. */
  raw?: string
  /** Every selected dropdown value. */
  selected?: string[]
  /** For buttons: whether a non-Off state is set. */
  on?: boolean
}

function stateName(value: PdfValue | undefined): string | undefined {
  if (isName(value)) return value.value
  return typeof value === 'string' ? value : undefined
}

function buttonState(model: PdfModel, field: AcroField): string | undefined {
  const value = stateName(model.resolve(field.dict.entries.get('V')))
  if (value !== undefined) return value
  const states = field.widgets
    .map((widget) => stateName(model.resolve(widget.dict.entries.get('AS'))))
    .filter((state): state is string => state !== undefined)
  return states.find((state) => state !== 'Off') ?? states[0]
}

function readField(model: PdfModel, field: AcroField): FieldState {
  if (field.type === 'checkbox' || field.type === 'radio') {
    const raw = buttonState(model, field)
    return { field, raw, on: raw !== undefined && raw !== 'Off' }
  }
  const value = model.resolve(field.dict.entries.get('V'))
  if (field.type === 'dropdown') {
    const selected = (Array.isArray(value) ? value : [value])
      .map((entry) => typeof entry === 'string' ? decodeTextString(entry) : undefined)
      .filter((entry): entry is string => entry !== undefined && entry.trim() !== '')
    return { field, raw: selected.length > 0 ? selected.join(', ') : undefined, selected }
  }
  const decoded = typeof value === 'string' ? decodeTextString(value) : undefined
  const text = decoded !== undefined && decoded.trim() !== '' ? decoded : undefined
  return { field, raw: text }
}

function assertReadablePdf(bytes: Uint8Array): void {
  const head = byteString(bytes.subarray(0, 1024))
  if (!head.includes('%PDF-')) {
    throw new PdfExtractionError('malformed_pdf', 'The input is not a PDF: it has no %PDF- header.')
  }
  // A cut-off incremental update still holds the earlier revision's marker, so
  // the file must end at its last one.
  const tail = byteString(bytes.subarray(Math.max(0, bytes.length - 2048)))
  const end = tail.lastIndexOf('%%EOF')
  if (end === -1 || !/^[\s\0]*$/.test(tail.slice(end + 5))) {
    throw new PdfExtractionError('malformed_pdf', 'The PDF is truncated: it does not end with an end-of-file marker.')
  }
}

function isEncrypted(model: PdfModel, bytes: Uint8Array): boolean {
  for (const record of model.objects.values()) {
    if (!isDict(record.value)) continue
    const type = record.value.entries.get('Type')
    if (isName(type) && type.value === 'XRef' && record.value.entries.has('Encrypt')) return true
  }
  return /trailer\s*<<(?:(?!startxref)[\s\S])*?\/Encrypt\b/.test(byteString(bytes))
}

async function loadFormFields(bytes: BinaryContent): Promise<{ model: PdfModel; fields: AcroField[] }> {
  assertReadablePdf(bytes)
  let model: PdfModel
  try {
    model = await PdfModel.load(bytes)
  } catch (error) {
    throw new PdfExtractionError('malformed_pdf', `The PDF could not be parsed: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (isEncrypted(model, bytes)) {
    throw new PdfExtractionError('encrypted_pdf', 'The PDF is encrypted, so its form field values cannot be read. Remove the encryption and try again.')
  }
  let fields: AcroField[]
  try {
    fields = acroFields(model).fields
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === 'PDF does not contain an AcroForm') fields = []
    else throw new PdfExtractionError('malformed_pdf', `The PDF could not be read: ${message}`)
  }
  const fillable = fields.filter((field) => field.type !== 'signature' && field.type !== 'button' && field.type !== 'unknown')
  if (fillable.length === 0) {
    throw new PdfExtractionError(
      'no_form_fields',
      'The PDF has no AcroForm fields to read. Flattened and scanned documents need the hosted Paradoc extraction service.',
    )
  }
  return { model, fields: fillable }
}

// ---------------------------------------------------------------------------
// Binding targets
// ---------------------------------------------------------------------------

type Target =
  /** A declared field, written with the formatter's text. */
  | { kind: 'field'; field: FormField }
  /** A member of a structured value or a party, written as its raw value. */
  | { kind: 'member'; type: 'number' | 'text' }
  /** Something extraction cannot write back: a computed value, an annex, a whole party. */
  | { kind: 'fixed'; reason: string }

const numericMembers: Record<string, ReadonlySet<string>> = {
  money: new Set(['amount']),
  coordinate: new Set(['latitude', 'longitude', 'lat', 'lon', 'lng']),
  bbox: new Set(['0', '1', '2', '3', 'minLatitude', 'minLongitude', 'maxLatitude', 'maxLongitude']),
}

function normalizePath(path: string): string {
  const trimmed = path.trim()
  return trimmed.startsWith('fields.') ? trimmed.slice('fields.'.length) : trimmed
}

function targetFor(form: Form, path: string): Target {
  const segments = pathSegments(path)
  const [root, ...rest] = segments
  if (root === 'parties') {
    return rest.length >= 2 && !(rest.length === 2 && /^\d+$/.test(rest[1]!))
      ? { kind: 'member', type: 'text' }
      : { kind: 'fixed', reason: 'A whole party is written as formatted text; bind its parts to recover them.' }
  }
  if (root === 'defs') return { kind: 'fixed', reason: 'Computed values are derived from other data, not read back.' }
  if (root === 'annexes') return { kind: 'fixed', reason: 'Annexes are attachments, not form field values.' }
  let field = root ? form.fields?.[root] : undefined
  if (!field) return { kind: 'fixed', reason: 'The path is artifact metadata, not a data value.' }
  for (let index = 0; index < rest.length; index++) {
    const segment = rest[index]!
    if (field.type === 'list' && /^\d+$/.test(segment)) field = field.item
    else if (field.type === 'fieldset' && field.fields[segment]) field = field.fields[segment]!
    else return { kind: 'member', type: numericMembers[field.type]?.has(segment) && index === rest.length - 1 ? 'number' : 'text' }
  }
  return { kind: 'field', field }
}

// ---------------------------------------------------------------------------
// Parsing values
// ---------------------------------------------------------------------------

type Parsed = { ok: true; value: unknown } | { ok: false; reason: string }

const ok = (value: unknown): Parsed => ({ ok: true, value })
const fail = (reason: string): Parsed => ({ ok: false, reason })

function numberSymbols(locale: string): { group: string; decimal: string } {
  try {
    const parts = new Intl.NumberFormat(locale).formatToParts(12345.6)
    return {
      group: parts.find((part) => part.type === 'group')?.value ?? ',',
      decimal: parts.find((part) => part.type === 'decimal')?.value ?? '.',
    }
  } catch {
    return { group: ',', decimal: '.' }
  }
}

function parseNumber(raw: string, locale: string): number | undefined {
  const text = raw.trim()
  if (/^[-+]?\d+(\.\d+)?$/.test(text)) return Number(text)
  const { group, decimal } = numberSymbols(locale)
  const grouped = text.split(group).join('').replace(/[\s\u00a0\u202f]/g, '').replace(/\u2212/g, '-')
  const normalized = decimal === '.' ? grouped : grouped.split(decimal).join('.')
  if (!/^[-+]?\d+(\.\d+)?$/.test(normalized)) return undefined
  const value = Number(normalized)
  return Number.isFinite(value) ? value : undefined
}

function isoDate(year: number, month: number, day: number): string | undefined {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return undefined
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function numericDateOrder(locale: string): Array<'year' | 'month' | 'day'> {
  try {
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' })
      .formatToParts(new Date(Date.UTC(2000, 0, 2)))
      .map((part) => part.type)
      .filter((type): type is 'year' | 'month' | 'day' => type === 'year' || type === 'month' || type === 'day')
  } catch {
    return ['month', 'day', 'year']
  }
}

function monthIndex(token: string, locale: string): number | undefined {
  const needle = token.replace(/\.$/, '').toLocaleLowerCase(locale)
  for (const style of ['long', 'short'] as const) {
    const format = new Intl.DateTimeFormat(locale, { month: style, timeZone: 'UTC' })
    for (let month = 0; month < 12; month++) {
      const name = format.format(new Date(Date.UTC(2000, month, 1))).replace(/\.$/, '').toLocaleLowerCase(locale)
      if (name === needle) return month + 1
    }
  }
  return undefined
}

function parseDate(raw: string, locale: string): string | undefined {
  const text = raw.trim()
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))

  const numeric = text.match(/^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})$/)
  if (numeric) {
    const values = [Number(numeric[1]), Number(numeric[2]), Number(numeric[3])]
    const order = numericDateOrder(locale)
    if (order.length !== 3) return undefined
    const part = (type: 'year' | 'month' | 'day') => values[order.indexOf(type)]!
    const yearText = numeric[order.indexOf('year') + 1]!
    if (yearText.length !== 4) return undefined
    return isoDate(part('year'), part('month'), part('day'))
  }

  const tokens = text.split(/[\s,]+/).filter(Boolean)
  if (tokens.length !== 3) return undefined
  let month: number | undefined
  const numbers: string[] = []
  for (const token of tokens) {
    if (/^\d+\.?$/.test(token)) numbers.push(token.replace(/\.$/, ''))
    else if (month === undefined) month = monthIndex(token, locale)
    else return undefined
  }
  if (month === undefined || numbers.length !== 2) return undefined
  const year = numbers.find((value) => value.length === 4)
  const day = numbers.find((value) => value.length <= 2)
  if (!year || !day) return undefined
  return isoDate(Number(year), month, Number(day))
}

function parseTime(raw: string): string | undefined {
  const text = raw.trim()
  const clock = text.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/)
  if (clock) return text
  const meridiem = text.match(/^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?\s*([AaPp])\.?\s*[Mm]\.?$/)
  if (!meridiem) return undefined
  const hour = Number(meridiem[1])
  if (hour < 1 || hour > 12) return undefined
  const pm = meridiem[4]!.toLowerCase() === 'p'
  const hours = String((hour % 12) + (pm ? 12 : 0)).padStart(2, '0')
  return `${hours}:${meridiem[2]}${meridiem[3] ? `:${meridiem[3]}` : ''}`
}

function matchOption(raw: string, options: readonly EnumOption[], formatter: Formatter, formatted: boolean): EnumOption | undefined {
  const label = (option: EnumOption) => {
    const result = formatter.safeFormatEnum(option.value, { options })
    return result.success ? result.value : option.label ?? String(option.value)
  }
  if (formatted) {
    const byLabel = options.filter((option) => label(option) === raw)
    if (byLabel.length === 1) return byLabel[0]
  }
  const byValue = options.filter((option) => String(option.value) === raw)
  if (byValue.length === 1) return byValue[0]
  const folded = raw.trim().toLowerCase()
  const loose = options.filter((option) => String(option.value).toLowerCase() === folded || label(option).toLowerCase() === folded)
  return loose.length === 1 ? loose[0] : undefined
}

let currencyCodes: readonly string[] | undefined

function currencies(): readonly string[] {
  if (currencyCodes) return currencyCodes
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  try {
    currencyCodes = intl.supportedValuesOf?.('currency') ?? []
  } catch {
    currencyCodes = []
  }
  if (currencyCodes.length === 0) currencyCodes = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'INR', 'MXN']
  return currencyCodes
}

function parseMoney(raw: string, field: FormField, formatter: Formatter): Parsed {
  const text = raw.trim()
  const amountText = text.replace(/^[^\d(+\-\u2212]+|[^\d)]+$/g, '').replace(/^\((.*)\)$/, '-$1')
  const amount = parseNumber(amountText, formatter.locale)
  if (amount === undefined) return fail('The value is not an amount of money.')
  // A field that declares its currency accepts no other, so only it is tried.
  const declared = field.type === 'money' ? field.currency : undefined
  const preferred = field.type === 'money' && field.default?.currency ? [field.default.currency] : []
  const candidates = declared
    ? [declared]
    : [...preferred, ...currencies().filter((code) => !preferred.includes(code))]
  const matches = new Set<string>()
  for (const currency of candidates) {
    const result = formatter.safeFormatMoney({ amount, currency })
    if (result.success && result.value === text) matches.add(currency)
    if (matches.size > 1) break
  }
  if (matches.size === 1) return ok({ amount, currency: [...matches][0] })
  return fail(matches.size === 0
    ? 'The currency cannot be determined from the text; write the amount with its currency symbol, or bind the amount on its own.'
    : 'The text matches more than one currency; declare the field\'s currency, or write the amount with its currency symbol.')
}

const composite = new Set(['address', 'person', 'organization', 'identification', 'coordinate', 'bbox', 'list', 'fieldset'])

/** Parse text written into one PDF field back into the field's type. */
function parseFieldValue(raw: string, field: FormField, formatter: Formatter, formatted: boolean): Parsed {
  if (composite.has(field.type)) {
    return fail(`A ${field.type} value written as one piece of text cannot be split back into its parts; bind its parts to recover it.`)
  }
  switch (field.type) {
    case 'text':
    case 'email':
    case 'uuid':
    case 'uri':
      return ok(raw)
    case 'enum': {
      const option = matchOption(raw, field.enum, formatter, formatted)
      return option ? ok(option.value) : fail('The text matches none of the field\'s options.')
    }
    case 'multiselect': {
      if (formatted) return fail('A multiselect value written as one piece of text cannot be split back into its options.')
      const values = raw.split(',').map((part) => part.trim()).filter(Boolean)
      const options = values.map((value) => matchOption(value, field.enum, formatter, false))
      return options.every((option) => option !== undefined)
        ? ok(options.map((option) => option!.value))
        : fail('The selection includes a value that matches none of the field\'s options.')
    }
    case 'boolean': {
      const text = raw.trim()
      const yes = formatter.safeFormatBoolean(true)
      const no = formatter.safeFormatBoolean(false)
      if (yes.success && text === yes.value) return ok(true)
      if (no.success && text === no.value) return ok(false)
      const folded = text.toLowerCase()
      if (folded === 'true' || folded === 'yes') return ok(true)
      if (folded === 'false' || folded === 'no') return ok(false)
      return fail('The text is not a yes or no value.')
    }
    case 'number':
    case 'rating': {
      const value = parseNumber(raw, formatter.locale)
      return value === undefined ? fail('The text is not a number.') : ok(value)
    }
    case 'percentage': {
      const value = parseNumber(raw.trim().replace(/\s*%$/, ''), formatter.locale)
      return value === undefined ? fail('The text is not a percentage.') : ok(value)
    }
    case 'money':
      return parseMoney(raw, field, formatter)
    case 'date': {
      const value = parseDate(raw, formatter.locale)
      return value === undefined ? fail('The text is not a date.') : ok(value)
    }
    case 'datetime': {
      const text = raw.trim()
      return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(text) && !Number.isNaN(Date.parse(text))
        ? ok(text)
        : fail('Only an ISO 8601 date and time can be read back exactly.')
    }
    case 'time': {
      const value = parseTime(raw)
      return value === undefined ? fail('The text is not a time of day.') : ok(value)
    }
    case 'duration': {
      const text = raw.trim()
      return /^P(?!$)(\d+(\.\d+)?Y)?(\d+(\.\d+)?M)?(\d+(\.\d+)?W)?(\d+(\.\d+)?D)?(T(?=\d)(\d+(\.\d+)?H)?(\d+(\.\d+)?M)?(\d+(\.\d+)?S)?)?$/.test(text)
        ? ok(text)
        : fail('Only an ISO 8601 duration can be read back exactly.')
    }
    case 'phone': {
      const text = raw.trim().replace(/[\s().-]/g, '')
      return /^\+[1-9]\d{1,14}$/.test(text) ? ok({ number: text }) : fail('The text is not an international phone number.')
    }
  }
  return fail(`Values of type ${field.type} cannot be read back.`)
}

function parseTarget(raw: string, target: Target, formatter: Formatter, formatted: boolean): Parsed {
  if (target.kind === 'fixed') return fail(target.reason)
  if (target.kind === 'field') return parseFieldValue(raw, target.field, formatter, formatted)
  if (target.type === 'number') {
    const value = parseNumber(raw, formatter.locale)
    return value === undefined ? fail('The text is not a number.') : ok(value)
  }
  return ok(raw)
}

// ---------------------------------------------------------------------------
// Reversing bindings
// ---------------------------------------------------------------------------

type Reading =
  | { kind: 'value'; value: unknown }
  | { kind: 'empty' }
  | { kind: 'unparseable'; reason: string }
  | { kind: 'not_recoverable'; reason: string }

interface PathWork {
  sources: PdfExtractionSource[]
  readings: Reading[]
  /** Split parts by one-based position. */
  parts: Map<number, string | undefined>
  /** Checkbox-map options by qualifier: true when checked. */
  options: Map<string, boolean>
  optionKind?: 'enum' | 'multiselect'
}

function source(state: FieldState | undefined, name: string): PdfExtractionSource {
  return state?.raw === undefined ? { field: name } : { field: name, value: state.raw }
}

function readDirect(state: FieldState, target: Target, formatter: Formatter): Reading {
  const { field } = state
  if (field.type === 'checkbox') {
    const isBoolean = target.kind === 'field' ? target.field.type === 'boolean' : false
    if (!isBoolean) {
      return state.on
        ? { kind: 'unparseable', reason: 'A checkbox can only be read back into a yes or no field.' }
        : { kind: 'empty' }
    }
    // An unchecked box cannot be told apart from an unanswered one.
    return state.on ? { kind: 'value', value: true } : { kind: 'empty' }
  }
  if (field.type === 'radio') {
    if (!state.on || state.raw === undefined) return { kind: 'empty' }
    const parsed = parseTarget(state.raw, target, formatter, false)
    return parsed.ok ? { kind: 'value', value: parsed.value } : { kind: 'unparseable', reason: parsed.reason }
  }
  if (field.type === 'dropdown') {
    if (!state.selected || state.selected.length === 0) return { kind: 'empty' }
    const raw = state.selected.join(', ')
    const parsed = parseTarget(raw, target, formatter, false)
    return parsed.ok ? { kind: 'value', value: parsed.value } : { kind: 'unparseable', reason: parsed.reason }
  }
  if (state.raw === undefined) return { kind: 'empty' }
  if (target.kind === 'fixed') return { kind: 'not_recoverable', reason: target.reason }
  if (target.kind === 'field' && composite.has(target.field.type)) {
    return { kind: 'not_recoverable', reason: `A ${target.field.type} value written as one piece of text cannot be split back into its parts; bind its parts to recover it.` }
  }
  const parsed = parseTarget(state.raw, target, formatter, target.kind === 'field')
  return parsed.ok ? { kind: 'value', value: parsed.value } : { kind: 'unparseable', reason: parsed.reason }
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function resolvePath(work: PathWork, target: Target, formatter: Formatter): { status: PdfExtractionStatus; value?: unknown; reason?: string } {
  const readings = [...work.readings]

  if (work.parts.size > 0) {
    const positions = [...work.parts.keys()].sort((left, right) => left - right)
    const values = positions.map((position) => work.parts.get(position))
    const lastFilled = values.reduce<number>((last, value, index) => value === undefined ? last : index, -1)
    if (lastFilled === -1) readings.push({ kind: 'empty' })
    else if (positions.some((position, index) => position !== index + 1)) {
      readings.push({ kind: 'not_recoverable', reason: 'The split parts are not all bound, so the value cannot be joined back.' })
    }
    else if (values.slice(0, lastFilled).some((value) => value === undefined)) {
      readings.push({ kind: 'unparseable', reason: 'A part before the last filled part is empty, so the parts cannot be joined in order.' })
    } else {
      const parsed = parseTarget(values.slice(0, lastFilled + 1).join('-'), target, formatter, false)
      readings.push(parsed.ok ? { kind: 'value', value: parsed.value } : { kind: 'unparseable', reason: parsed.reason })
    }
  }

  if (work.options.size > 0) {
    const checked = [...work.options].filter(([, on]) => on).map(([qualifier]) => qualifier)
    const declared = target.kind === 'field' && (target.field.type === 'enum' || target.field.type === 'multiselect') ? target.field.enum : []
    const valueOf = (qualifier: string) => declared.find((option) => String(option.value) === qualifier)?.value ?? qualifier
    if (checked.length === 0) readings.push({ kind: 'empty' })
    else if (work.optionKind === 'multiselect') readings.push({ kind: 'value', value: checked.map(valueOf) })
    else if (checked.length === 1) readings.push({ kind: 'value', value: valueOf(checked[0]!) })
    else readings.push({ kind: 'unparseable', reason: 'More than one option is checked for a field that takes one.' })
  }

  const problems = readings.filter((reading): reading is Extract<Reading, { kind: 'unparseable' }> => reading.kind === 'unparseable')
  if (problems.length > 0) return { status: 'unparseable', reason: problems.map((problem) => problem.reason).join(' ') }
  const values = readings.filter((reading): reading is Extract<Reading, { kind: 'value' }> => reading.kind === 'value')
  if (values.length > 0) {
    const [first] = values
    if (values.every((reading) => sameValue(reading.value, first!.value))) return { status: 'recovered', value: first!.value }
    return { status: 'unparseable', reason: 'The PDF fields that carry this path hold different values.' }
  }
  const lost = readings.find((reading): reading is Extract<Reading, { kind: 'not_recoverable' }> => reading.kind === 'not_recoverable')
  if (lost) return { status: 'not_recoverable', reason: lost.reason }
  return { status: 'empty' }
}

function setValue(root: Record<string, unknown>, segments: string[], value: unknown): void {
  let current: Record<string, unknown> | unknown[] = root
  for (let index = 0; index < segments.length - 1; index++) {
    const key = segments[index]!
    const nextIsIndex = /^\d+$/.test(segments[index + 1]!)
    const container = current as Record<string, unknown>
    if (container[key] === undefined || container[key] === null || typeof container[key] !== 'object') {
      container[key] = nextIsIndex ? [] : {}
    }
    current = container[key] as Record<string, unknown> | unknown[]
  }
  ;(current as Record<string, unknown>)[segments.at(-1)!] = value
}

function placeValue(data: PdfExtractedData, path: string, value: unknown): void {
  const segments = pathSegments(path)
  const [root, ...rest] = segments
  if (root === 'parties' && rest.length > 0) {
    data.parties ??= {}
    setValue(data.parties, rest, value)
    return
  }
  setValue(data.fields, segments, value)
}

/**
 * Read a filled PDF back into artifact data through the layer's bindings.
 *
 * Only exact reversals are returned: direct fields, split fields, checkbox and
 * radio maps. A joined binding's raw text is reported as not recoverable, and
 * text that does not parse into the field's type is reported with its raw
 * value. Nothing is validated here; pass the data to the normal fill path.
 */
export async function extractPdfData({ pdf, form, bindings, formatter: filledWith = defaultFormatter, format }: ExtractPdfDataOptions): Promise<PdfExtraction> {
  const formatter = format?.money ? filledWith.compose({ money: format.money }) : filledWith
  const sources = Object.values(bindings).flatMap((binding) => binding.split(',').map((part) => normalizePath(part.split(':')[0]!)))
  validateFieldBindings(form, Object.fromEntries(sources.map((path, index) => [String(index), path])))

  const { model, fields } = await loadFormFields(pdf)
  const states = new Map(fields.map((field) => [field.name, readField(model, field)]))

  const bound = Object.keys(bindings).filter((name) => states.has(name))
  if (bound.length === 0) {
    throw new PdfExtractionError(
      'not_matching',
      `None of the PDF's ${fields.length} form fields match the layer's ${Object.keys(bindings).length} bindings. Check that the PDF is this artifact's form.`,
    )
  }

  const work = new Map<string, PathWork>()
  const workFor = (path: string): PathWork => {
    let entry = work.get(path)
    if (!entry) {
      entry = { sources: [], readings: [], parts: new Map(), options: new Map() }
      work.set(path, entry)
    }
    return entry
  }

  for (const [pdfName, binding] of Object.entries(bindings)) {
    const state = states.get(pdfName)

    if (binding.includes(',')) {
      for (const part of binding.split(',')) {
        const entry = workFor(normalizePath(part))
        entry.sources.push(source(state, pdfName))
        entry.readings.push(state?.raw === undefined
          ? { kind: 'empty' }
          : { kind: 'not_recoverable', reason: 'Several values are joined into one PDF field, and extraction does not guess how to split them.' })
      }
      continue
    }

    const separator = binding.indexOf(':')
    const path = normalizePath(separator === -1 ? binding : binding.slice(0, separator))
    const entry = workFor(path)
    entry.sources.push(source(state, pdfName))
    const target = targetFor(form, path)
    const qualifier = separator === -1 ? undefined : binding.slice(separator + 1).trim()
    const fieldType = target.kind === 'field' ? target.field.type : undefined
    const isPart = qualifier !== undefined && fieldType !== 'boolean' && fieldType !== 'enum' && fieldType !== 'multiselect' && /^[1-9]\d*$/.test(qualifier)
    if (!state) {
      // A part whose PDF field is missing still holds its place in the order.
      if (isPart) entry.parts.set(Number(qualifier), undefined)
      else entry.readings.push({ kind: 'empty' })
      continue
    }

    if (qualifier === undefined) {
      entry.readings.push(readDirect(state, target, formatter))
      continue
    }

    if (fieldType === 'boolean') {
      entry.readings.push(readDirect(state, target, formatter))
    } else if (fieldType === 'enum' || fieldType === 'multiselect') {
      entry.optionKind = fieldType
      entry.options.set(qualifier, state.field.type === 'checkbox' || state.field.type === 'radio'
        ? Boolean(state.on)
        : state.raw !== undefined)
    } else if (isPart) {
      entry.parts.set(Number(qualifier), state.raw)
    } else {
      entry.readings.push(state.raw === undefined
        ? { kind: 'empty' }
        : { kind: 'not_recoverable', reason: `The qualifier "${qualifier}" has no reverse mapping for this field.` })
    }
  }

  const data: PdfExtractedData = { fields: {} }
  const entries: PdfExtractionEntry[] = []
  for (const [path, entry] of work) {
    const resolved = resolvePath(entry, targetFor(form, path), formatter)
    if (resolved.status === 'recovered') placeValue(data, path, resolved.value)
    entries.push({
      path,
      status: resolved.status,
      sources: entry.sources,
      ...(resolved.reason ? { reason: resolved.reason } : {}),
    })
  }

  const boundNames = new Set(Object.keys(bindings))
  const unbound: PdfUnboundField[] = []
  for (const state of states.values()) {
    if (boundNames.has(state.field.name)) continue
    const type = state.field.type
    if (type !== 'text' && type !== 'checkbox' && type !== 'radio' && type !== 'dropdown') continue
    const hasValue = type === 'checkbox' || type === 'radio' ? state.on : state.raw !== undefined
    if (hasValue && state.raw !== undefined) unbound.push({ field: state.field.name, type, value: state.raw })
  }

  return { data, report: { entries, unbound } }
}

/** A PDF layer as the artifact declares it. */
interface PdfLayerSpec {
  mimeType?: string
  bindings?: Record<string, string>
  bindingsFrom?: string
  format?: LayerFormat
}

/**
 * Choose the PDF layer to read against: the named one, or the only PDF layer.
 * Returns its key, resolved bindings, and declared format.
 */
export function selectPdfExtractionLayer(
  layers: Record<string, PdfLayerSpec> | undefined,
  requested?: string,
): { key: string; bindings: Record<string, string>; format?: LayerFormat } {
  const all = layers ?? {}
  const pdfKeys = Object.keys(all).filter((key) => all[key]?.mimeType?.toLowerCase() === 'application/pdf')
  let key = requested
  if (key !== undefined) {
    const layer = all[key]
    if (!layer) {
      throw new PdfExtractionError('layer_not_found', `Layer "${key}" not found. PDF layers: ${pdfKeys.join(', ') || '(none)'}.`)
    }
    if (layer.mimeType?.toLowerCase() !== 'application/pdf') {
      throw new PdfExtractionError('not_pdf_layer', `Layer "${key}" is ${layer.mimeType ?? 'not a PDF'}. PDF layers: ${pdfKeys.join(', ') || '(none)'}.`)
    }
  } else if (pdfKeys.length === 0) {
    throw new PdfExtractionError('no_pdf_layer', `The artifact has no PDF layer to read against. Layers: ${Object.keys(all).join(', ') || '(none)'}.`)
  } else if (pdfKeys.length > 1) {
    throw new PdfExtractionError('layer_required', `The artifact has several PDF layers; name one: ${pdfKeys.join(', ')}.`)
  } else {
    key = pdfKeys[0]!
  }
  const layer = all[key]!
  const bindings = layer.bindings ?? (layer.bindingsFrom ? all[layer.bindingsFrom]?.bindings : undefined)
  if (!bindings || Object.keys(bindings).length === 0) {
    throw new PdfExtractionError('not_matching', `Layer "${key}" has no bindings, so no PDF field maps to the artifact.`)
  }
  // The format is the layer's own: a layer reusing another's bindings declares its own.
  return { key, bindings, ...(layer.format && { format: layer.format }) }
}
