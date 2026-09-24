/**
 * @paradoc/core - Public Type Definitions
 *
 * This file contains all public interfaces and types for the @paradoc/core package.
 * Centralizing types here provides:
 * - Easy documentation generation
 * - Better discoverability for developers
 * - Clean separation of types from implementations
 */

import type {
  Form,
  Document,
  Bundle,
  Checklist,
  ParadocRenderer,
  RendererLayer,
  Formatter,
  FormatterProgressivePolicy,
  FormData,
} from '@paradoc/types'

import type { RendererRegistry } from './rendering/renderer-registry'
import type { DeepReadonly } from './artifacts/shared/definition-types'

// Re-export RendererLayer for convenience
export type { RendererLayer } from '@paradoc/types'

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Instance template structure containing field values and optional annexes.
 * Used for validating form data payloads.
 */
export interface InstanceTemplate extends Record<string, unknown> {
  fields: Record<string, unknown>
  annexes?: Record<string, unknown>
}

/**
 * Represents a validation error for a specific field.
 */
export interface ValidationError {
  /** The field path that failed validation (e.g., 'fields.age' or 'annexes.schedule') */
  field: string
  /** Human-readable error message */
  message: string
  /** The invalid value that caused the error */
  value?: unknown
}

/**
 * Successful validation result containing the validated data.
 *
 * @typeParam T - The type of the validated data
 */
export interface ValidationSuccess<T> {
  /** Indicates successful validation */
  success: true
  /** The validated and potentially transformed data */
  data: T
  /** Always null on success */
  errors: null
}

/**
 * Failed validation result containing error details.
 */
export interface ValidationFailure {
  /** Indicates failed validation */
  success: false
  /** Always null on failure */
  data: null
  /** Array of validation errors */
  errors: ValidationError[]
}

/**
 * Result of a validation operation - either success with data or failure with errors.
 *
 * @typeParam T - The type of the validated data on success
 *
 * @example
 * ```typescript
 * const result = form.safeParseData(input)
 * if (result.success) {
 *   console.log(result.data)  // Validated data
 * } else {
 *   console.log(result.errors)  // Array of ValidationError
 * }
 * ```
 */
export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure

// ============================================================================
// ARTIFACT VALIDATION OPTIONS
// ============================================================================

/**
 * Options for validating artifact definitions.
 */
export interface ValidateOptions {
  /** Whether to validate schema structure. Default: true */
  schema?: boolean
  /** Whether to validate logic expressions. Default: true */
  logic?: boolean
  /** Whether to collect all errors or stop at first. Default: true */
  collectAllErrors?: boolean
}

// ============================================================================
// SERIALIZATION OPTIONS
// ============================================================================

/**
 * Supported serialization formats.
 */
export type SerializationFormat = 'json' | 'yaml'

/**
 * Options for serializing artifacts to JSON or YAML.
 */
export interface SerializationOptions {
  /** YAML indentation (default: 2) */
  yamlIndent?: number
  /** Sort object keys alphabetically */
  sortKeys?: boolean
  /** Include the current dated `$schema` address (default: true) */
  includeSchema?: boolean
}

// ============================================================================
// FORM RENDERING OPTIONS
// ============================================================================

/**
 * Options for rendering a form to a specific output format.
 *
 * @typeParam Output - The output type produced by the renderer (e.g., string, Uint8Array)
 *
 * @example
 * ```typescript
 * const output = await form.render({
 *   data: { fields: { name: 'John', age: 30 } },
 *   layer: 'markdown'
 * })
 * ```
 */
export interface RenderOptions<Output = string | Uint8Array> {
  /** Custom renderer override. Supported layer MIME types use the built-in renderer by default. */
  renderer?: ParadocRenderer<RendererLayer, Output>

  /** Formatter policy applied throughout this artifact render. */
  formatter?: Formatter

  /** Explicit missing/incomplete value policy for progressive previews. */
  progressive?: FormatterProgressivePolicy

  /**
   * Renderers keyed by layer MIME type, consulted when no `renderer` override
   * is given and before the built-in engines. This is how a format core does
   * not ship, such as a React composition, reaches the render call.
   */
  renderers?: RendererRegistry

  /**
   * The values to populate the layer with, in the shape a filled form's render
   * hands its renderer: field values under `fields`, and `parties`, `annexes`
   * and `defs` beside them. Omitted, the layer renders with no values.
   */
  data?: FormData

  /** Key of the layer to use. If not provided, uses defaultLayer or first available. */
  layer?: string

  /**
   * PDF layers only: AcroForm field name -> Paradoc path, laid over the
   * layer's own bindings. Refused for any other layer.
   */
  bindings?: Record<string, string>
}

/**
 * Options for rendering a RuntimeForm (data is already attached).
 *
 * This is the same as RenderOptions but without the `data` property,
 * since RuntimeForm already contains the validated data.
 *
 * @typeParam Output - The output type produced by the renderer
 *
 * @example
 * ```typescript
 * const filled = form.fill({ name: 'John', age: 30 })
 *
 * // No data or renderer needed - the form already contains the validated data,
 * // and supported layer MIME types use the built-in renderer.
 * const output = await filled.render({ layer: 'html' })
 * ```
 */
export interface RuntimeFormRenderOptions<Output = string | Uint8Array> {
  /** Custom renderer override. Supported layer MIME types use the built-in renderer by default. */
  renderer?: ParadocRenderer<RendererLayer, Output>

  /** Formatter policy applied throughout this artifact render. */
  formatter?: Formatter

  /** Explicit missing/incomplete value policy for progressive previews. */
  progressive?: FormatterProgressivePolicy

  /**
   * Renderers keyed by layer MIME type, consulted when no `renderer` override
   * is given and before the built-in engines. This is how a format core does
   * not ship, such as a React composition, reaches the render call.
   */
  renderers?: RendererRegistry

  /** Key of the layer to use. If not provided, uses defaultLayer or first available. */
  layer?: string

  /**
   * PDF layers only: AcroForm field name -> Paradoc path, laid over the
   * layer's own bindings. Refused for any other layer.
   */
  bindings?: Record<string, string>
}

/**
 * Options for rendering a RuntimeChecklist.
 *
 * The renderer is optional. Without one, the layer renders through the renderer
 * registered for its MIME type, or the built-in engine for that type, which
 * evaluates the template's expressions, such as {{items.reviewed}}.
 *
 * @typeParam Output - The output type produced by the renderer
 *
 * @example
 * ```typescript
 * const filled = checklist.fill({ reviewed: true, approved: false })
 *
 * // The built-in engine for the layer's MIME type evaluates {{items.x}}
 * const output = await filled.render({ layer: 'markdown' })
 *
 * // Or pass a renderer explicitly
 * const custom = await filled.render({ renderer: textRenderer(), layer: 'markdown' })
 * ```
 */
export interface RuntimeChecklistRenderOptions<Output = unknown> {
  /** Custom renderer override. Supported layer MIME types use the built-in renderer by default. */
  renderer?: ParadocRenderer<RendererLayer, Output>

  /** Formatter policy applied throughout this artifact render. */
  formatter?: Formatter

  /** Explicit missing/incomplete value policy for progressive previews. */
  progressive?: FormatterProgressivePolicy

  /**
   * Renderers keyed by layer MIME type, consulted after an explicit `renderer`
   * and before the built-in engines.
   */
  renderers?: RendererRegistry

  /** Key of the layer to use. If not provided, uses defaultLayer or first available. */
  layer?: string
}

// ============================================================================
// ARTIFACT INPUT TYPES
// ============================================================================

/**
 * Input type for creating a Form instance.
 * The `kind` property is optional and defaults to 'form'.
 *
 * @example
 * ```typescript
 * const form = p.form({
 *   name: 'my-form',
 *   version: '1.0.0',
 *   fields: { name: { type: 'text' } }
 * })
 * ```
 */
export type FormInput = Omit<Form, 'kind'> & { kind?: 'form' }

/**
 * Input type for creating a Document instance.
 * The `kind` property is optional and defaults to 'document'.
 *
 * @example
 * ```typescript
 * const doc = p.document({
 *   name: 'my-document',
 *   version: '1.0.0',
 *   layers: { markdown: { kind: 'inline', mimeType: 'text/markdown', text: '# Hello' } }
 * })
 * ```
 */
export type DocumentInput = Omit<Document, 'kind'> & { kind?: 'document' }

/**
 * Input type for creating a Bundle instance.
 * The `kind` property is optional and defaults to 'bundle'.
 *
 * @example
 * ```typescript
 * const bundle = p.bundle({
 *   name: 'my-bundle',
 *   version: '1.0.0',
 *   contents: [{ ref: './form.yaml' }]
 * })
 * ```
 */
export type BundleInput = DeepReadonly<Omit<Bundle, 'kind'>> & { readonly kind?: 'bundle' }

/**
 * Input type for creating a Checklist instance.
 * The `kind` property is optional and defaults to 'checklist'.
 *
 * @example
 * ```typescript
 * const checklist = p.checklist({
 *   name: 'my-checklist',
 *   version: '1.0.0',
 *   items: [{ id: 'item-1', label: 'First item' }]
 * })
 * ```
 */
export type ChecklistInput = DeepReadonly<Omit<Checklist, 'kind'>> & { readonly kind?: 'checklist' }
