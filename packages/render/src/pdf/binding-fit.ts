/**
 * Authoring check that the values an artifact can bind to a PDF form's text
 * fields fit their boxes.
 *
 * Filling fails when a value cannot fit its box at {@link MIN_FONT_SIZE}, or
 * has more characters than a comb field has boxes. This check finds those
 * failures before any data exists: for each binding to an AcroForm text field
 * it builds values the bound artifact field accepts and lays them out with the
 * same code filling uses.
 *
 * A text, email, uuid, or uri field is checked at its length bound: `maxLength`
 * characters, or the length its `pattern` bounds (a uuid without a pattern
 * takes its 36-character canonical form). Two values of that length are laid out:
 * - a typical value: each open position holds the next character of
 *   {@link TYPICAL_TEXT}; a position the pattern constrains holds the allowed
 *   character nearest the allowed characters' mean width. When it cannot fit,
 *   ordinary answers fail to fill: an error.
 * - the widest value: each position holds the widest character it may hold
 *   (the widest Latin letter or digit when open, `W` in Helvetica). When only
 *   this value cannot fit, unusual answers fail to fill: a warning.
 *
 * A split binding (`path:2`) takes the matching hyphen-separated part of the
 * pattern, or the whole value's bound when the pattern does not fix the parts.
 * Enum and multiselect fields write known option values, so they are checked
 * exactly: the widest option value, or the widest `max` values (all of them
 * without `max`) joined with ", ". A comma-joined binding joins each path's
 * value with ", ". More characters than a comb field has boxes is an error.
 *
 * The font is the one filling would choose: the layer's declared font, then
 * the form's own font for the field, then Helvetica. A font supplied only at
 * render time is not known here.
 */

import type { Form, FormField } from '@paradoc/types'
import { acroFields, textFieldDrawing, widgetLayout, type AcroField } from './acroform'
import { PdfFontSet, type PdfFont } from './drawing-fonts'
import { layoutFieldText, MIN_FONT_SIZE, PdfFieldFillError, type FieldLayout } from './field-appearance'
import { analyzePattern, REFERENCE_REPERTOIRE, type CharSet } from './pattern-bounds'
import { parseBinding, splitPartIndex, type PdfBindingPart } from '../layer-bindings'
import { fieldDefinition } from './render'
import { PdfModel } from './syntax'

/**
 * The text a typical value is made of: an English pangram with its word spaces,
 * repeated. It holds every lowercase letter, one capital, and spaces at about
 * the rate English prose has them, so its mean advance (456 units in Helvetica)
 * sits just above that of letter-frequency-weighted English text (441).
 */
export const TYPICAL_TEXT = 'The quick brown fox jumps over the lazy dog '

/** Why a binding may not fit its PDF text field. */
export type PdfBindingFitReason = 'overflow' | 'comb-length' | 'unbounded'

/** One binding whose values may not fit the PDF text field it fills. */
export interface PdfBindingFitIssue {
  /** Fully qualified name of the PDF form field. */
  field: string
  /** The binding as the layer declares it. */
  binding: string
  /** The artifact paths the binding reads, such as `fields.amountSource`. */
  paths: string[]
  /**
   * `error` when a typical value, an option value, or a value's length cannot
   * be filled; `warning` when only the widest value overflows, or nothing
   * bounds the value.
   */
  severity: 'error' | 'warning'
  reason: PdfBindingFitReason
  /** Which value failed: a typical one, or the widest. Absent for `unbounded`. */
  value?: 'typical' | 'widest'
  /** For `overflow`, the minimum font size in points; for `comb-length`, the number of comb boxes. */
  limit?: number
  /** Characters in the widest value checked. */
  length?: number
  message: string
}

/** Options for {@link checkPdfBindingFit}. */
export interface CheckPdfBindingFitOptions {
  /** The PDF layer's bytes. */
  template: Uint8Array
  form: Form
  /** The layer's bindings; without them, fields fill the PDF fields of the same name. */
  bindings?: Record<string, string>
  /** The font the layer declares. */
  layerFont?: PdfFont
}

const TEXT_TYPES = new Set(['text', 'email', 'uuid', 'uri'])
const UUID_PATTERN = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
const ANY: CharSet = { any: true }

/** The font a value is measured in: the metrics filling uses, and which characters it can draw. */
interface MeasuringFont {
  width(text: string): number
  covers(text: string): boolean
}

type ValueKind = 'typical' | 'widest'

/** The values one bound path accepts at its length bound, built for a font. */
interface BoundSource {
  path: string
  /** Every character the value may hold, used to choose the font. */
  probe: string
  /** What bounds the value, such as `maxLength 200`. */
  basis: string
  /** True when the value is one of known option values, so typical and widest are one check. */
  exact: boolean
  value(font: MeasuringFont, kind: ValueKind): string
}

type SourceAnalysis =
  | { kind: 'bounded'; source: BoundSource }
  | { kind: 'unbounded'; path: string }
  | { kind: 'other' }

/** Longest widest value a message quotes in full. */
const SHOWN_LENGTH = 40
const format = (value: number) => String(Number(value.toFixed(3)))
const displayPath = (path: string) => `fields.${path}`

function widestCharacter(font: MeasuringFont, sets: CharSet[]): string {
  const pool = sets.some((item) => item.any)
    ? [...new Set([...REFERENCE_REPERTOIRE, ...sets.flatMap((item) => item.any ? [] : item.chars)])]
    : [...new Set(sets.flatMap((item) => item.any ? [] : item.chars))]
  const drawable = pool.filter((character) => font.covers(character))
  const candidates = drawable.length > 0 ? drawable : pool
  return candidates.reduce((best, character) => measure(font, character) > measure(font, best) ? character : best, candidates[0] ?? 'W')
}

/** The allowed character nearest the allowed characters' mean width, or the typical text's character when it is allowed. */
function typicalCharacter(font: MeasuringFont, set: CharSet, position: number): string {
  const sample = TYPICAL_TEXT[position % TYPICAL_TEXT.length]!
  if (set.any || set.chars.includes(sample)) return sample
  const drawable = set.chars.filter((character) => font.covers(character))
  const pool = drawable.length > 0 ? drawable : set.chars
  const mean = pool.reduce((total, character) => total + measure(font, character), 0) / pool.length
  return pool.reduce((best, character) =>
    Math.abs(measure(font, character) - mean) < Math.abs(measure(font, best) - mean) ? character : best, pool[0]!)
}

function picker(font: MeasuringFont, kind: ValueKind): (set: CharSet, position: number) => string {
  return kind === 'widest'
    ? (set) => widestCharacter(font, [set])
    : (set, position) => typicalCharacter(font, set, position)
}

/** One set holding every character any of `sets` allows. */
function unionSet(sets: CharSet[]): CharSet {
  return sets.some((item) => item.any) ? ANY : { any: false, chars: [...new Set(sets.flatMap((item) => item.any ? [] : item.chars))] }
}

function measure(font: MeasuringFont, text: string): number {
  return font.covers(text) ? font.width(text) : 0
}

function probeOf(sets: CharSet[]): string {
  const chars = new Set(sets.flatMap((item) => item.any ? REFERENCE_REPERTOIRE : item.chars))
  return [...chars].join('')
}

function textSource(path: string, field: FormField & { maxLength?: number; pattern?: string }, part?: number): SourceAnalysis {
  const declared = field.pattern ?? (field.type === 'uuid' ? UUID_PATTERN : undefined)
  const analysis = declared === undefined ? undefined : analyzePattern(declared)
  const shapeFor = (font: MeasuringFont, kind: ValueKind) => {
    const width = (text: string) => measure(font, text)
    const pick = picker(font, kind)
    return part === undefined ? analysis?.shape(width, pick) : analysis?.part(part, width, pick)
  }
  const lengthOnly: MeasuringFont = { width: (text) => text.length, covers: () => true }
  const shape = shapeFor(lengthOnly, 'widest')
  const maxLength = Math.min(field.maxLength ?? Infinity, shape?.maxLength ?? Infinity)
  if (maxLength === Infinity) return { kind: 'unbounded', path }
  const sets = shape?.sets ?? analysis?.sets() ?? [ANY]
  const byPattern = shape !== undefined && shape.value !== undefined && (field.maxLength === undefined || shape.maxLength <= field.maxLength)
  const partLabel = part === undefined ? '' : ` (part ${part + 1})`
  const basis = byPattern ? `pattern ${declared}${partLabel}` : `maxLength ${field.maxLength}${partLabel}`
  return {
    kind: 'bounded',
    source: {
      path,
      probe: probeOf(sets),
      basis,
      exact: false,
      value(font, kind) {
        const measured = shapeFor(font, kind)
        if (byPattern && measured?.value !== undefined) return measured.value
        const pick = picker(font, kind)
        const set = unionSet(sets)
        return Array.from({ length: maxLength }, (_, position) => pick(set, position)).join('')
      },
    },
  }
}

function choiceSource(path: string, field: FormField): SourceAnalysis {
  if (field.type !== 'enum' && field.type !== 'multiselect') return { kind: 'other' }
  const values = field.enum.map((option) => String(option.value))
  if (values.length === 0) return { kind: 'other' }
  const count = field.type === 'multiselect' ? Math.min(field.max ?? values.length, values.length) : 1
  return {
    kind: 'bounded',
    source: {
      path,
      probe: values.join(''),
      basis: field.type === 'enum' ? 'its widest option value' : count === values.length ? 'all its option values' : `its ${count} widest option values`,
      exact: true,
      value(font) {
        return [...values].sort((left, right) => measure(font, right) - measure(font, left)).slice(0, count).join(', ')
      },
    },
  }
}

/** What one binding path fills a text field with. */
function analyzeSource(form: Form, { path, qualifier }: PdfBindingPart): SourceAnalysis {
  const field = fieldDefinition(form, path)
  if (!field) return { kind: 'other' }
  if (qualifier !== undefined) {
    // A qualifier on a boolean, choice, or list field tests a value, which fills a checkbox.
    if (!TEXT_TYPES.has(field.type)) return { kind: 'other' }
    const part = splitPartIndex(qualifier)
    return part === undefined ? { kind: 'other' } : textSource(path, field as FormField & { maxLength?: number }, part)
  }
  if (TEXT_TYPES.has(field.type)) return textSource(path, field as FormField & { maxLength?: number })
  return choiceSource(path, field)
}

/** The sources a binding reads, or why it is not checked. */
function analyzeBinding(form: Form, binding: string): SourceAnalysis[] | undefined {
  const sources = parseBinding(binding).map((part) => analyzeSource(form, part))
  // A joined value is checked only when every part is known.
  if (sources.some((source) => source.kind === 'other')) return undefined
  return sources
}

function describe(layout: FieldLayout): string {
  return `${format(layout.width)} × ${format(layout.height)} pt box`
}

function fitFailure(field: AcroField, binding: string, sources: BoundSource[], layout: FieldLayout, text: string, kind: ValueKind, error: PdfFieldFillError): PdfBindingFitIssue | undefined {
  if (error.reason !== 'overflow' && error.reason !== 'comb-length') return undefined
  const length = [...text].length
  const paths = sources.map((source) => displayPath(source.path))
  const shown = length <= SHOWN_LENGTH ? `: "${text}"` : ''
  const exact = sources.every((source) => source.exact)
  const adjective = exact || error.reason === 'comb-length' ? 'longest' : kind
  const what = sources.length === 1
    ? `the ${adjective} value ${paths[0]} accepts under ${sources[0]!.basis} (${length} characters${shown})`
    : `the ${adjective} joined value of ${paths.join(', ')} (${length} characters)`
  const message = error.reason === 'comb-length'
    ? `${what} has more characters than the field's ${error.limit} comb boxes`
    : `${what} does not fit the ${describe(layout)} at the minimum size of ${format(error.limit ?? MIN_FONT_SIZE)} pt` +
      (kind === 'widest' ? '; a typical value fits, but one made mostly of wide letters such as W does not' : '')
  return {
    field: field.name,
    binding,
    paths,
    severity: kind === 'typical' ? 'error' : 'warning',
    reason: error.reason,
    value: kind,
    ...(error.limit !== undefined && { limit: error.limit }),
    length,
    message,
  }
}

/**
 * Check that every value the artifact accepts for a binding to a PDF text
 * field can be filled: that it fits the box at the minimum font size, and
 * that it has no more characters than a comb field has boxes. A text field
 * with nothing bounding its length is a warning. A PDF without an AcroForm
 * has nothing to check.
 *
 * @throws {PdfFontError} when the layer's font cannot be read.
 * @throws {PdfBindingSyntaxError} when a binding cannot be parsed.
 */
export async function checkPdfBindingFit({ template, form, bindings, layerFont }: CheckPdfBindingFitOptions): Promise<PdfBindingFitIssue[]> {
  const model = await PdfModel.load(template)
  let acro: ReturnType<typeof acroFields>
  try {
    acro = acroFields(model)
  } catch (error) {
    if (error instanceof Error && error.message === 'PDF does not contain an AcroForm') return []
    throw error
  }
  const fonts = PdfFontSet.create(model, { layerFont })
  await fonts.readFormFonts(model.dict(acro.acroForm.entries.get('DR')))
  const byName = new Map(acro.fields.map((field) => [field.name, field]))
  const entries = bindings
    ? Object.entries(bindings)
    : Object.entries(form.fields ?? {}).filter(([, field]) => field.type !== 'fieldset').map(([name]) => [name, name] as const)

  const issues: PdfBindingFitIssue[] = []
  for (const [name, binding] of entries) {
    const field = byName.get(name)
    if (!field || field.type !== 'text') continue
    const analyzed = analyzeBinding(form, binding)
    if (!analyzed) continue
    const drawing = textFieldDrawing(field)
    const layouts = field.widgets
      .map((widget) => widgetLayout(model, field, widget, drawing))
      .filter((layout): layout is NonNullable<typeof layout> => layout !== undefined)
    if (layouts.length === 0) continue

    const unbounded = analyzed.filter((source): source is Extract<SourceAnalysis, { kind: 'unbounded' }> => source.kind === 'unbounded')
    if (unbounded.length > 0) {
      const paths = unbounded.map((source) => displayPath(source.path))
      issues.push({
        field: field.name,
        binding,
        paths,
        severity: 'warning',
        reason: 'unbounded',
        message: `${paths.join(', ')} has no maxLength or pattern that bounds its length, so a long value can fail to fill the ${describe(layouts[0]!)}${drawing.comb ? ` with ${drawing.comb} comb boxes` : ''}`,
      })
      continue
    }

    const sources = analyzed.map((source) => (source as Extract<SourceAnalysis, { kind: 'bounded' }>).source)
    for (const layout of layouts) {
      const issue = checkLayout(fonts, field, binding, sources, layout)
      if (issue) {
        issues.push(issue)
        break
      }
    }
  }
  return issues
}

function checkLayout(fonts: PdfFontSet, field: AcroField, binding: string, sources: BoundSource[], layout: FieldLayout & { appearance: { fontName?: string } }): PdfBindingFitIssue | undefined {
  let chosen: MeasuringFont
  try {
    chosen = fonts.select(field.name, sources.map((source) => source.probe).join(''), layout.appearance.fontName)
  } catch (error) {
    // Characters no font can draw are a font question, not a fit question.
    if (error instanceof PdfFieldFillError) return undefined
    throw error
  }
  for (const kind of ['typical', 'widest'] as const) {
    if (kind === 'widest' && sources.every((source) => source.exact)) break
    const text = sources.map((source) => source.value(chosen, kind)).join(', ')
    try {
      layoutFieldText(layout, text, fonts.select(field.name, text, layout.appearance.fontName))
    } catch (error) {
      if (!(error instanceof PdfFieldFillError)) throw error
      return fitFailure(field, binding, sources, layout, text, kind, error)
    }
  }
  return undefined
}
