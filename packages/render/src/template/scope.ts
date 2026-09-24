/**
 * Evaluating template expressions.
 *
 * A template reads the same expression context as the artifact's other
 * expressions. A loop binds its row: `item` (and `parent` for the enclosing
 * row) in text templates, the named variable in DOCX. `index`, `first`, and
 * `last` answer where a row sits, and exist only inside a loop.
 */

import type { Formatter } from '@paradoc/types'
import {
  buildRegistry,
  EvaluationError,
  evaluate,
  T,
  truthy,
  Values,
  type EvaluationContext,
  type Expr,
  type FnSignature,
  type HostFunction,
  type Registry,
  type Value,
} from '@paradoc/expr'
import { FormattedFieldValue, unwrapFormattedValue } from '../text/field-formatter'
import { TemplateError, type TemplatePosition } from './errors'

const DEFAULT_REGISTRY = buildRegistry()

/** Loop-only functions, available to expressions inside a loop and nowhere else. */
export const LOOP_FUNCTIONS: readonly FnSignature[] = [
  { name: 'index', category: 'collection', params: [{ name: 'row', type: T.unknown }], returns: { kind: 'fixed', type: T.number }, hostInjected: true, deterministic: true },
  { name: 'first', category: 'collection', params: [{ name: 'row', type: T.unknown }], returns: { kind: 'fixed', type: T.boolean }, hostInjected: true, deterministic: true },
  { name: 'last', category: 'collection', params: [{ name: 'row', type: T.unknown }], returns: { kind: 'fixed', type: T.boolean }, hostInjected: true, deterministic: true },
]

export const LOOP_FUNCTION_NAMES: ReadonlySet<string> = new Set(LOOP_FUNCTIONS.map((signature) => signature.name))

/** A registry that adds the loop-only functions to `base`. */
export function withLoopFunctions(base: Registry | undefined): Registry {
  const registry = base ?? DEFAULT_REGISTRY
  const signatures = new Map(registry.signatures)
  for (const signature of LOOP_FUNCTIONS) signatures.set(signature.name, signature)
  return {
    signatures,
    has: (name) => signatures.has(name),
    get: (name) => signatures.get(name),
    names: () => [...signatures.keys()],
  }
}

/** Where a loop's rows sit in the artifact, so aggregates skip the rows the artifact hides. */
export interface RowOrigin {
  listPath: string
  indices: readonly number[]
}

export interface Frame {
  /** `each` binds `item` and `parent`; a DOCX loop binds its own name. */
  kind: 'each' | 'named'
  name?: string
  value: Value
  /** The row in the render data: formatted values, and party records with their signing context. */
  data: unknown
  index: number
  count: number
  origin?: RowOrigin
}

/** What a template renders against, beside its expression context. */
export interface TemplateEnvironment {
  formatter: Formatter
  /** The render data at an expression path rooted at `fields`, `parties`, `items`, or a computed value. */
  resolveData(segments: readonly string[]): unknown
  layer?: string
}

/** The segments of an identifier-rooted path, with literal list indexes, or undefined. */
export function referenceSegments(node: Expr): string[] | undefined {
  if (node.kind === 'Identifier') return [node.name]
  if (node.kind === 'Member') {
    const base = referenceSegments(node.object)
    return base ? [...base, node.property] : undefined
  }
  if (node.kind === 'Index' && ((node.index.kind === 'NumberLiteral' && /^\d+$/.test(node.index.value)) || node.index.kind === 'StringLiteral')) {
    const base = referenceSegments(node.object)
    return base ? [...base, node.index.value] : undefined
  }
  return undefined
}

const blocked = new Set(['__proto__', 'constructor', 'prototype'])

/** Read a path through render data, looking through formatted wrappers on the way down. */
export function dataPath(value: unknown, segments: readonly string[]): unknown {
  let current = value
  for (const [index, segment] of segments.entries()) {
    current = unwrapFormattedValue(current)
    if (blocked.has(segment) || current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
    if (index === segments.length - 1) return current
  }
  return current
}

/** Plain JavaScript for an expression value, for directives that read records. */
export function fromValue(value: Value): unknown {
  switch (value.kind) {
    case 'number': return value.value.toNumber()
    case 'string':
    case 'boolean': return value.value
    case 'null': return null
    case 'array': return value.value.map(fromValue)
    case 'object': return Object.fromEntries([...value.value].map(([key, member]) => [key, fromValue(member)]))
  }
}

function isPlainRecord(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !(value instanceof FormattedFieldValue)
}

/**
 * The loop frame `name` binds, innermost first: a DOCX loop's row name, or
 * `item` for the innermost unnamed row and `parent` for the one around it.
 */
export function frameFor<F extends { kind: string; name?: string }>(frames: readonly F[], name: string): F | undefined {
  let rows = 0
  for (let index = frames.length - 1; index >= 0; index--) {
    const frame = frames[index]!
    if (frame.kind === 'named') {
      if (frame.name === name) return frame
      continue
    }
    rows++
    if ((name === 'item' && rows === 1) || (name === 'parent' && rows === 2)) return frame
  }
  return undefined
}

export class TemplateScope {
  constructor(
    readonly root: EvaluationContext,
    readonly environment: TemplateEnvironment,
    readonly frames: readonly Frame[] = [],
  ) {}

  push(frame: Frame): TemplateScope {
    return new TemplateScope(this.root, this.environment, [...this.frames, frame])
  }

  /** The innermost row, whatever binds it. */
  current(): Frame | undefined {
    return this.frames.at(-1)
  }

  frameFor(name: string): Frame | undefined {
    return frameFor(this.frames, name)
  }

  context(): EvaluationContext {
    if (this.frames.length === 0) return this.root
    const rowFunction = (answer: (frame: Frame) => Value): HostFunction => (args) => {
      const frame = this.frames.find((candidate) => candidate.value === args[0])
      if (!frame) throw new EvaluationError('type-error', 'index, first, and last take a loop row, such as item')
      return answer(frame)
    }
    const rowVisible = this.root.rowVisible
    return {
      lookup: (name) => this.frameFor(name)?.value ?? this.root.lookup(name),
      asOf: this.root.asOf,
      registry: withLoopFunctions(this.root.registry),
      hostFunctions: {
        ...this.root.hostFunctions,
        index: rowFunction((frame) => Values.num(String(frame.index))),
        first: rowFunction((frame) => Values.boolean(frame.index === 0)),
        last: rowFunction((frame) => Values.boolean(frame.index === frame.count - 1)),
      },
      rowVisible: rowVisible && ((listPath, indices) => {
        const [head, ...rest] = listPath.split('.')
        const frame = head ? this.frameFor(head) : undefined
        if (!frame) return rowVisible(listPath, indices)
        if (!frame.origin) return true
        return rowVisible([frame.origin.listPath, ...rest].join('.'), [...frame.origin.indices, ...indices])
      }),
    }
  }

  evaluate(node: Expr, source: string, position: TemplatePosition): Value {
    try {
      return evaluate(node, this.context())
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const code = error instanceof EvaluationError ? error.code : 'evaluation-error'
      throw new TemplateError({ code, message, expression: source, position }, this.environment.layer)
    }
  }

  /** The render data an expression reads, when it is a path into it. */
  dataAt(node: Expr): unknown {
    const segments = referenceSegments(node)
    if (!segments) return undefined
    const [head, ...rest] = segments
    const frame = head ? this.frameFor(head) : undefined
    if (frame) return rest.length === 0 ? frame.data : dataPath(frame.data, rest)
    return this.environment.resolveData(segments)
  }

  /** Where the rows of a list path sit in the artifact, when the list is a path it declares. */
  originOf(node: Expr): RowOrigin | undefined {
    const segments = referenceSegments(node)
    if (!segments) return undefined
    const [head, ...rest] = segments
    const frame = head ? this.frameFor(head) : undefined
    if (frame) {
      return frame.origin
        ? { listPath: [frame.origin.listPath, ...rest].join('.'), indices: frame.origin.indices }
        : undefined
    }
    return head === 'fields' ? { listPath: segments.join('.'), indices: [] } : undefined
  }

  /**
   * The text a placeholder prints. A path prints the value the way the
   * artifact formats it; a computed value is formatted by its type.
   */
  present(node: Expr, source: string, position: TemplatePosition): string {
    if (node.kind === 'Conditional') {
      const test = this.evaluate(node.test, source, position)
      return this.present(truthy(test) ? node.consequent : node.alternate, source, position)
    }
    if (node.kind === 'Call' && node.callee === 'coalesce') {
      for (const arg of node.args) {
        if (this.evaluate(arg, source, position).kind !== 'null') return this.present(arg, source, position)
      }
      return ''
    }
    if (referenceSegments(node)) {
      const data = this.dataAt(node)
      if (data !== undefined && !isPlainRecord(data) && !Array.isArray(data)) {
        return data === null ? '' : String(data)
      }
      if (data instanceof FormattedFieldValue) return String(data)
    }
    return this.formatValue(this.evaluate(node, source, position), node)
  }

  private formatValue(value: Value, node: Expr): string {
    const { formatter } = this.environment
    switch (value.kind) {
      case 'null': return ''
      case 'boolean': return formatter.formatBoolean(value.value)
      case 'number': return formatter.formatNumber(value.value.toNumber())
      case 'string': {
        const signature = node.kind === 'Call' ? (this.root.registry ?? DEFAULT_REGISTRY).get(node.callee) : undefined
        const returns = signature?.returns.kind === 'fixed' ? signature.returns.type.kind : undefined
        if (returns === 'date') return formatter.formatDate(value.value)
        if (returns === 'datetime') return formatter.formatDatetime(value.value)
        return value.value
      }
      case 'array': return value.value.map((element) => this.formatValue(element, node)).join(', ')
      case 'object': {
        const amount = value.value.get('amount')
        const currency = value.value.get('currency')
        if (amount?.kind === 'number' && currency?.kind === 'string') {
          return formatter.formatMoney({ amount: amount.value.toNumber(), currency: currency.value })
        }
        return ''
      }
    }
  }
}
