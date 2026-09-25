/** The part of a layer that decides which bindings it fills with. */
export interface LayerBindingsSpec {
  mimeType?: string
  bindings?: Record<string, string>
  bindingsFrom?: string
}

// @paradoc/render does not depend on @paradoc/schemas, so the PDF check is stated here.
function isPdfLayer(layer: LayerBindingsSpec): boolean {
  return layer.mimeType?.toLowerCase() === 'application/pdf'
}

/**
 * The bindings a layer fills with: its own, or else those of the sibling layer
 * its `bindingsFrom` names. The reference is one hop: the sibling's own
 * `bindings`, never its `bindingsFrom`. Only bindings carry over; a layer's
 * `format` is always its own.
 *
 * Only PDF layers have bindings, which map AcroForm field names to Paradoc
 * paths; any other layer, or a source that is not a PDF layer, gives none.
 *
 * Throws when `bindingsFrom` names a layer that does not exist.
 */
export function resolveLayerBindings(
  layers: Record<string, LayerBindingsSpec>,
  layer: LayerBindingsSpec,
): Record<string, string> | undefined {
  if (!isPdfLayer(layer)) return undefined
  if (layer.bindings || !layer.bindingsFrom) return layer.bindings
  const source = layers[layer.bindingsFrom]
  if (!source) {
    throw new Error(`bindingsFrom "${layer.bindingsFrom}" references unknown layer. Available: ${Object.keys(layers).join(', ')}`)
  }
  return isPdfLayer(source) ? source.bindings : undefined
}

/** One path a PDF binding value reads. */
export interface PdfBindingPart {
  /** The path as the binding writes it, trimmed: `fields.name`, `ssn`. */
  source: string
  /** Where the path sits in fill data, historically without the `fields` root. */
  path: string
  /** The text after `:`, trimmed: the option a checkbox tests, or the one-based part a split binding fills. */
  qualifier?: string
}

/** A PDF binding value whose syntax no fill, extraction, or check can read. */
export class PdfBindingSyntaxError extends Error {
  readonly binding: string

  constructor(binding: string, problem: string) {
    super(`Binding ${JSON.stringify(binding)} ${problem}.`)
    this.name = 'PdfBindingSyntaxError'
    this.binding = binding
  }
}

/**
 * Parse a PDF binding value into the paths it reads. Fill, extraction, the fit
 * check, and validation all read bindings through this one parser.
 *
 * - `name` or `fields.name` reads one path.
 * - `status:married` tests an option; `ssn:2` fills the second hyphen-separated
 *   part. Space around the `:` is ignored.
 * - `city, state, zip` joins several whole values with `, `. A part of a joined
 *   binding takes no qualifier.
 *
 * @throws {PdfBindingSyntaxError} for an empty part or qualifier, or a
 * qualifier inside a joined binding.
 */
export function parseBinding(binding: string): PdfBindingPart[] {
  const parts = binding.split(',').map((text): PdfBindingPart => {
    const separator = text.indexOf(':')
    const source = (separator === -1 ? text : text.slice(0, separator)).trim()
    if (!source) throw new PdfBindingSyntaxError(binding, 'has an empty path')
    if (separator === -1) return { source, path: bindingDataPath(source) }
    const qualifier = text.slice(separator + 1).trim()
    if (!qualifier) throw new PdfBindingSyntaxError(binding, `has an empty qualifier after "${source}:"`)
    return { source, path: bindingDataPath(source), qualifier }
  })
  if (parts.length > 1 && parts.some((part) => part.qualifier !== undefined)) {
    throw new PdfBindingSyntaxError(binding, 'qualifies a part of a joined binding; a joined binding reads whole values')
  }
  return parts
}

/** Each binding of a layer, keyed by the PDF field it fills, with the paths it reads. */
export type ParsedPdfBindings = [pdfName: string, parts: PdfBindingPart[]][]

/** Parse every binding of a layer. @throws {PdfBindingSyntaxError} as {@link parseBinding} does. */
export function parseBindings(bindings: Record<string, string>): ParsedPdfBindings {
  return Object.entries(bindings).map(([pdfName, binding]) => [pdfName, parseBinding(binding)])
}

/**
 * The zero-based part a split qualifier names: `2` is `1`. Undefined when the
 * qualifier is not a positive whole number, so it names an option instead.
 */
export function splitPartIndex(qualifier: string): number | undefined {
  return /^[1-9]\d*$/.test(qualifier) ? Number(qualifier) - 1 : undefined
}

/** A PDF binding key that names no form field of the template. */
export class PdfBindingKeyError extends Error {
  /** The binding keys the template has no field for. */
  readonly keys: string[]

  constructor(keys: string[], templateFields: string[]) {
    super(
      `PDF bindings name form fields the template does not have: ${keys.map((key) => JSON.stringify(key)).join(', ')}. ` +
        (templateFields.length > 0 ? `Template fields: ${templateFields.join(', ')}` : 'The template has no form fields'),
    )
    this.name = 'PdfBindingKeyError'
    this.keys = keys
  }
}

/** The normalized artifact path used to validate and extract a PDF binding. */
export function bindingDataPath(path: string): string {
  const trimmed = path.trim()
  return trimmed.startsWith('fields.') ? trimmed.slice('fields.'.length) : trimmed
}

/** The path used to read a binding from canonical render data. */
export function renderDataPath(data: Record<string, unknown>, path: string): string {
  const trimmed = path.trim()
  const hasFieldsRoot = data.fields !== null && typeof data.fields === 'object' && !Array.isArray(data.fields)
  if (!hasFieldsRoot) return bindingDataPath(trimmed)
  if (trimmed.startsWith('fields.')) return trimmed
  const root = trimmed.split('.', 1)[0]
  return root === 'parties' || root === 'annexes' || root === 'defs' || root === '_signers' || root === '_captures'
    ? trimmed
    : `fields.${trimmed}`
}
