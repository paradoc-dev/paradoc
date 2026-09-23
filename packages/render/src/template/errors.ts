/**
 * Template diagnostics: where an expression sits in a layer, and what replaces
 * syntax the single expression language no longer accepts.
 */

/** A position inside a text template (1-based line and column). */
export interface TemplatePosition {
  line: number
  column: number
}

/** One problem found in a template, at authoring validation or render. */
export interface TemplateDiagnostic {
  /** Stable category: `syntax`, `removed-syntax`, `markers`, a checker code, or an evaluation code. */
  code: string
  message: string
  /** The expression source, when the problem is inside one. */
  expression?: string
  /** Line and column in a text template, or in the paragraph of a DOCX part. */
  position?: TemplatePosition
  /** The DOCX part and paragraph, such as `word/document.xml paragraph 12`. */
  location?: string
}

/** Describe where a diagnostic sits, for messages. */
export function describeLocation(diagnostic: Pick<TemplateDiagnostic, 'position' | 'location'>): string {
  const parts: string[] = []
  if (diagnostic.location) parts.push(diagnostic.location)
  if (diagnostic.position) parts.push(`line ${diagnostic.position.line}, column ${diagnostic.position.column}`)
  return parts.join(', ')
}

/** A template that cannot render: malformed markers, a failed expression, or removed syntax. */
export class TemplateError extends Error {
  readonly code: string
  readonly layer?: string
  readonly expression?: string
  readonly position?: TemplatePosition
  readonly location?: string
  readonly diagnostic: TemplateDiagnostic

  constructor(diagnostic: TemplateDiagnostic, layer?: string) {
    const where = [layer ? `layer "${layer}"` : '', describeLocation(diagnostic)].filter(Boolean).join(', ')
    const expression = diagnostic.expression === undefined ? '' : ` in {{${diagnostic.expression}}}`
    super(`${where ? `Template error at ${where}` : 'Template error'}${expression}: ${diagnostic.message}`)
    this.name = 'TemplateError'
    this.code = diagnostic.code
    this.layer = layer
    this.expression = diagnostic.expression
    this.position = diagnostic.position
    this.location = diagnostic.location
    this.diagnostic = diagnostic
  }

  /** The same error, naming the layer it came from. */
  inLayer(layer: string | undefined): TemplateError {
    return layer && !this.layer ? new TemplateError(this.diagnostic, layer) : this
  }
}

const COMPARISON_HELPERS: Record<string, string> = { eq: '==', ne: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=' }

/**
 * The replacement for syntax the old template dialects used, or undefined when
 * the source shows none of it. Checked before an expression is parsed so the
 * author sees what to write instead of a bare syntax error.
 */
export function removedSyntaxHint(source: string): string | undefined {
  const text = source.trim()
  const helper = text.match(/^\(?\s*(eq|ne|gt|gte|lt|lte|not|and|or|contains|default)\s+(?![=<>!])/)
  if (helper) {
    const name = helper[1]!
    if (COMPARISON_HELPERS[name]) {
      return `The "${name}" helper is removed; compare with the ${COMPARISON_HELPERS[name]} operator, such as fields.status ${COMPARISON_HELPERS[name]} "active".`
    }
    if (name === 'not') return 'The "not" helper is removed; write not before the condition, such as not fields.approved.'
    if (name === 'and' || name === 'or') return `The "${name}" helper is removed; join conditions with the ${name} operator, such as fields.a ${name} fields.b.`
    if (name === 'contains') return 'The "contains" helper is removed; write "value" in fields.list or contains(fields.list, "value").'
    return 'The "default" helper is removed; use coalesce(fields.value, "fallback").'
  }
  if (/^(signature|initials|signatureDate|capacity|printedName)\s+["']/.test(text)) {
    const name = text.split(/\s/)[0]
    return `Write ${name}("location") inside a party loop, or ${name}(parties.role, "location").`
  }
  if (/===|!==/.test(text)) return 'The === and !== operators are removed; use == and !=.'
  if (/(^|[^\w.])this\b/.test(text)) return '"this" is removed; use item inside a loop, or a full path such as fields.name.'
  if (text.includes('../')) return '"../" is removed; use parent inside a nested loop, or a full path from the root.'
  if (/@root\b/.test(text)) return '"@root" is removed; write the path from the root, such as fields.name.'
  if (/@index\b/.test(text)) return '"@index" is removed; use index(item) inside a loop.'
  if (/@first\b/.test(text)) return '"@first" is removed; use first(item) inside a loop.'
  if (/@last\b/.test(text)) return '"@last" is removed; use last(item) inside a loop.'
  if (/@key\b/.test(text)) return '"@key" is removed; a loop runs over a list.'
  if (/(^|[^\w])\$[A-Za-z_]/.test(text)) return 'The $name form is removed; a DOCX loop names its row, such as {{FOR line IN fields.items}} and then {{line.amount}}.'
  if (/\.\[\d+\]/.test(text)) return 'The .[n] segment is removed; index a list with [n], such as parties.preparer[0].'
  return undefined
}
