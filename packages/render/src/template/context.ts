/**
 * The expression context a template reads, and where its paths sit in the
 * render data.
 *
 * Roots are those of every other artifact expression: `fields`, computed
 * values by name, `parties`, and `items` for a checklist. An artifact runtime
 * hands over its own context; a direct render builds one from the data. A
 * printed path may also name an attachment as `annexes.<slot>`.
 */

import {
  buildRegistry,
  createContext,
  type EvaluationContext,
  type FnSignature,
  type HostFunction,
  type Registry,
} from '@paradoc/expr'
import type { Form, RendererExpressions } from '@paradoc/types'
import { RENDER_DATA_ROOTS } from '../render-data'
import { dataPath } from './scope'

/**
 * How a renderer is told what template expressions can read and call.
 *
 * Its `context` is the one a render request carries in `ctx.expressions`
 * (`RendererExpressions` from `@paradoc/types`); the functions and their
 * signatures come from the renderer's own options.
 */
export interface TemplateExpressionOptions {
  /**
   * The artifact's expression context. `@paradoc/core` supplies it, so a
   * template sees exactly what field logic sees.
   */
  context?: EvaluationContext
  /** Host-configured functions, used when no context is supplied. */
  functions?: Readonly<Record<string, HostFunction>>
  /** Signatures of the configured functions. A template cannot call a function it has no signature for. */
  signatures?: readonly FnSignature[]
}

/**
 * The expression options for one render: the renderer's configured functions,
 * and the expression context the request carries.
 *
 * `@paradoc/core` builds that context with `@paradoc/expr`'s `createContext`;
 * `@paradoc/types` declares it structurally, so it stays free of the expression
 * engine. This is the one place a renderer reads it back as the engine's type.
 */
export function requestExpressions(
  configured: Pick<TemplateExpressionOptions, 'functions' | 'signatures'> | undefined,
  supplied: RendererExpressions | undefined,
): TemplateExpressionOptions {
  return {
    ...configured,
    ...(supplied && { context: supplied.context as EvaluationContext }),
  }
}


function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

/** Roots for a direct render, read from raw data the way core lays out a render. */
export function templateRoots(raw: Record<string, unknown>, form?: Form): Record<string, unknown> {
  const nestedFields = record(raw.fields)
  const fields: Record<string, unknown> = nestedFields ? { ...nestedFields } : {}
  // Without a form, a checklist's `items` record is its own root; a list named items is a field.
  const items = form?.fields ? undefined : record(raw.items)
  const fieldIds = nestedFields
    ? []
    : form?.fields
    ? Object.keys(form.fields)
    : Object.keys(raw).filter((key) => !RENDER_DATA_ROOTS.has(key) && !(key === 'items' && items))
  for (const id of fieldIds) if (Object.prototype.hasOwnProperty.call(raw, id)) fields[id] = raw[id]
  const roots: Record<string, unknown> = { fields }
  const parties = record(raw.parties)
  if (parties) roots.parties = parties
  if (items) roots.items = items
  const defs = record(raw.defs)
  if (defs) for (const [key, value] of Object.entries(defs)) roots[key] = value
  return roots
}

/**
 * A supplied context with the renderer's configured functions added, so a host
 * that configures functions on its renderer reaches templates rendered through
 * an artifact too.
 */
function withConfiguredFunctions(context: EvaluationContext, expressions: TemplateExpressionOptions): EvaluationContext {
  if (!expressions.functions && !expressions.signatures) return context
  const configured = buildRegistry(expressions.signatures ?? [])
  const signatures = new Map(configured.signatures)
  for (const [name, signature] of context.registry?.signatures ?? []) signatures.set(name, signature)
  const registry: Registry = {
    signatures,
    has: (name) => signatures.has(name),
    get: (name) => signatures.get(name),
    names: () => [...signatures.keys()],
  }
  return { ...context, registry, hostFunctions: { ...expressions.functions, ...context.hostFunctions } }
}

export interface TemplateData {
  context: EvaluationContext
  resolveData(segments: readonly string[]): unknown
}

/**
 * The expression context and render-data lookup for one render. `raw` holds
 * unformatted values; `prepared` holds the formatted values the renderer
 * prints.
 */
export function templateData(
  raw: Record<string, unknown>,
  prepared: Record<string, unknown>,
  form: Form | undefined,
  expressions: TemplateExpressionOptions | undefined,
): TemplateData {
  const context = expressions?.context
    ? withConfiguredFunctions(expressions.context, expressions)
    : createContext(templateRoots(raw, form), {
        hostFunctions: expressions?.functions,
        registry: expressions?.signatures ? buildRegistry(expressions.signatures) : undefined,
      })
  const defs = record(prepared.defs)

  return {
    context,
    resolveData(segments) {
      const [head, ...rest] = segments
      if (head === undefined) return undefined
      if (head === 'fields') {
        if (rest.length === 0) return undefined
        return dataPath(record(prepared.fields) ?? prepared, rest)
      }
      if (head === 'parties' || head === 'annexes' || head === 'items') return dataPath(prepared[head], rest)
      if (defs && Object.prototype.hasOwnProperty.call(defs, head)) return dataPath(defs[head], rest)
      return undefined
    },
  }
}
