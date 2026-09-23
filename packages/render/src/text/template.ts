import type { Formatter } from '@paradoc/types'
import type { EvaluationContext, Expr, Value } from '@paradoc/expr'
import { TemplateError, type TemplateDiagnostic } from '../template/errors'
import { parseTemplate, type ExpressionSlot, type TemplateNode } from '../template/markers'
import { fromValue, TemplateScope, type Frame } from '../template/scope'
import { unwrapFormattedValue } from './field-formatter'

/** Places a signing mark for a party at a location: `signature`, `initials`, and the related directives. */
export type SigningDirective = (party: unknown, root: Record<string, unknown>, args: unknown[]) => unknown

/** Names a template writes as signing directives rather than as expression functions. */
export const SIGNING_DIRECTIVES: ReadonlySet<string> = new Set(['signature', 'initials', 'signatureDate', 'capacity', 'printedName'])

export interface TemplateRenderOptions {
  /** The expression context: fields, computed values, parties, items, and configured functions. */
  context: EvaluationContext
  /** Render data (formatted values and signing records) at an expression path. */
  resolveData(segments: readonly string[]): unknown
  /** The render data root, which signing directives read captures and signers from. */
  root: Record<string, unknown>
  formatter: Formatter
  directives?: Record<string, SigningDirective>
  /** Escapes an interpolated value for the output format; identity when the format needs none. */
  escape: (value: string) => string
  /** The layer key, for error messages. */
  layer?: string
}

function fail(slot: ExpressionSlot, message: string, code: string, layer?: string): never {
  throw new TemplateError({ code, message, expression: slot.source, position: slot.position }, layer)
}

function parsed(slot: ExpressionSlot, layer?: string): Expr {
  if (slot.ast) return slot.ast
  throw new TemplateError(slot.problem as TemplateDiagnostic, layer)
}

/** The answer a block condition gives: a boolean, with a missing value read as false. */
function condition(value: Value, slot: ExpressionSlot, layer?: string): boolean {
  if (value.kind === 'boolean') return value.value
  if (value.kind === 'null') return false
  return fail(slot, `A condition must be boolean, got ${value.kind}.`, 'non-boolean-gate', layer)
}

/** The rows a loop runs over: a list, with a missing value read as no rows. */
export function loopRows(value: Value, slot: ExpressionSlot, layer?: string): readonly Value[] {
  if (value.kind === 'array') return value.value
  if (value.kind === 'null') return []
  return fail(slot, `A loop source must be a list, got ${value.kind}.`, 'type-mismatch', layer)
}

/** Frames for each row of a loop source, carrying the rows' render data and origin. */
export function loopFrames(
  scope: TemplateScope,
  node: Expr,
  rows: readonly Value[],
  bind: Pick<Frame, 'kind' | 'name'>,
): Frame[] {
  const data = unwrapFormattedValue(scope.dataAt(node))
  const origin = scope.originOf(node)
  return rows.map((value, index) => ({
    ...bind,
    value,
    data: Array.isArray(data) ? data[index] : undefined,
    index,
    count: rows.length,
    origin: origin ? { listPath: origin.listPath, indices: [...origin.indices, index] } : undefined,
  }))
}

/** Render one signing directive: the party is the innermost row, or given first. */
export function renderDirective(
  node: Extract<Expr, { kind: 'Call' }>,
  slot: ExpressionSlot,
  scope: TemplateScope,
  options: Pick<TemplateRenderOptions, 'directives' | 'root' | 'layer'>,
): string {
  const directive = options.directives?.[node.callee]
  if (!directive) return fail(slot, `${node.callee}() is not available in this layer.`, 'unknown-function', options.layer)
  if (node.args.length < 1 || node.args.length > 2) {
    return fail(slot, `${node.callee} takes a location, or a party and a location, such as ${node.callee}(parties.tenant, "tenant-sign").`, 'arity', options.layer)
  }
  const locationNode = node.args.at(-1)!
  const location = scope.evaluate(locationNode, slot.source, slot.position)
  if (location.kind !== 'string') return fail(slot, `${node.callee}'s location must be a string.`, 'type-mismatch', options.layer)
  let party: unknown
  if (node.args.length === 2) {
    const partyNode = node.args[0]!
    const data = scope.dataAt(partyNode)
    party = data === undefined ? fromValue(scope.evaluate(partyNode, slot.source, slot.position)) : unwrapFormattedValue(data)
  } else {
    const row = scope.current()
    if (!row) return fail(slot, `${node.callee}("${location.value}") needs a party: use it inside a party loop, or pass the party first, such as ${node.callee}(parties.tenant, "${location.value}").`, 'arity', options.layer)
    party = row.data === undefined ? fromValue(row.value) : unwrapFormattedValue(row.data)
  }
  const result = directive(party, options.root, [location.value])
  return result === null || result === undefined ? '' : String(result)
}

export function renderTemplateNodes(nodes: readonly TemplateNode[], scope: TemplateScope, options: TemplateRenderOptions): string {
  const { escape } = options
  let result = ''
  for (const node of nodes) {
    if (node.type === 'text') {
      result += node.value
      continue
    }
    const expression = parsed(node.slot, options.layer)

    if (node.type === 'value') {
      const text = expression.kind === 'Call' && SIGNING_DIRECTIVES.has(expression.callee)
        ? renderDirective(expression, node.slot, scope, options)
        : scope.present(expression, node.slot.source, node.slot.position)
      result += node.escaped ? escape(text) : text
      continue
    }

    const value = scope.evaluate(expression, node.slot.source, node.slot.position)
    if (node.type === 'if' || node.type === 'unless') {
      const answer = condition(value, node.slot, options.layer)
      const include = node.type === 'if' ? answer : !answer
      result += renderTemplateNodes(include ? node.children : node.inverse, scope, options)
      continue
    }

    const rows = loopRows(value, node.slot, options.layer)
    if (rows.length === 0) {
      result += renderTemplateNodes(node.inverse, scope, options)
      continue
    }
    for (const frame of loopFrames(scope, expression, rows, { kind: 'each' })) {
      result += renderTemplateNodes(node.children, scope.push(frame), options)
    }
  }
  return result
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"'`=]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;',
    '=': '&#x3D;',
  })[char]!)
}

/** Render a text template with the artifact expression language. */
export function renderTemplate(template: string, options: TemplateRenderOptions): string {
  const scope = new TemplateScope(options.context, {
    formatter: options.formatter,
    resolveData: options.resolveData,
    layer: options.layer,
  })
  try {
    return renderTemplateNodes(parseTemplate(template), scope, options)
  } catch (error) {
    throw error instanceof TemplateError ? error.inLayer(options.layer) : error
  }
}

