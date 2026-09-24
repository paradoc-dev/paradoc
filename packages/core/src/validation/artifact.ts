import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { Form, Document, Checklist, Bundle, Resolver } from '@paradoc/types'
import { validateLogic, type LogicValidatableArtifact } from '@/logic'
import {
  validateFileTemplates,
  validateInlineTemplates,
  type TemplateArtifact,
} from '@/logic/design-time/validation/validate-templates'
import { parse } from '@/serialization/serialization'
import { findSchemaVersionError } from '@/serialization/schema-version'
import { validatePdfLayers, type LayerValidationIssue } from './pdf-layers'
import { validatePdfBindingPaths } from './pdf-bindings'
import { validateFileReferences } from './file-references'
import { validateLayerReferences } from './layer-references'
import {
  validateForm,
  validateDocument,
  validateChecklist,
  validateBundle,
} from '@/validation'

// Re-export ValidateOptions from centralized types.ts
export type { ValidateOptions } from '@/types'
export type { LayerValidationIssue } from './pdf-layers'

// Import for internal use
import type { ValidateOptions } from '@/types'

type ArtifactKind = 'form' | 'document' | 'checklist' | 'bundle'

// Error format from validators (compatible with both AJV and Zod)
interface ValidatorError {
  instancePath?: string
  message?: string
  keyword?: string
  params?: Record<string, unknown>
}

// Map of artifact kinds to their validators
const validatorMap: Record<ArtifactKind, (data: unknown) => boolean> = {
  form: validateForm,
  document: validateDocument,
  checklist: validateChecklist,
  bundle: validateBundle,
}

/**
 * Map validator errors to Standard Schema issues
 */
function mapErrors(errors: ValidatorError[] | null | undefined): StandardSchemaV1.Issue[] {
  if (!Array.isArray(errors) || errors.length === 0) {
    return [{ message: 'Validation failed', path: [] }]
  }
  return errors.map((err) => ({
    message: err.message || 'Validation failed',
    path: err.instancePath?.split('/').filter(Boolean) || [],
  }))
}

/**
 * Validates an artifact's schema version and schema structure only.
 * Returns Standard Schema compliant result.
 *
 * A `$schema` the artifact declares, on the root or on an inline bundle part,
 * must name the current schema version; an artifact without one is taken as
 * built in memory. Use `migrate` to upgrade an older artifact.
 *
 * For full validation including logic expressions, use `validate()` instead.
 *
 * @param artifact - The artifact to validate (Form, Document, etc.)
 * @returns Standard Schema Result: { value } or { issues }
 *
 * @example
 * ```typescript
 * const result = validateSchema(myForm);
 *
 * if (result.issues) {
 *   console.error('Schema validation failed:', result.issues);
 * } else {
 *   console.log('Valid artifact structure:', result.value);
 * }
 * ```
 */
export function validateSchema<T = unknown>(artifact: unknown): StandardSchemaV1.Result<T> {
  // Check if artifact has a kind property
  if (typeof artifact !== 'object' || artifact === null || !('kind' in artifact)) {
    return {
      issues: [
        {
          message: 'Artifact must be an object with a "kind" property',
          path: [],
        },
      ],
    }
  }

  // The same version rule every entry point applies: a `$schema` the artifact
  // declares, on the root or on an inline bundle part, must be current.
  const versionError = findSchemaVersionError(artifact, { required: false })
  if (versionError) {
    return { issues: [{ message: versionError.message, path: [...versionError.path] }] }
  }

  // Strip $schema before validation (it's metadata, not part of the artifact structure)
  // This avoids issues with unevaluatedProperties: false on Intersect schemas
  const artifactToValidate = { ...(artifact as Record<string, unknown>) }
  delete artifactToValidate.$schema

  const kind = (artifact as { kind: unknown }).kind

  if (
    typeof kind !== 'string' ||
    !['form', 'document', 'checklist', 'bundle'].includes(kind)
  ) {
    return {
      issues: [
        {
          message: `Invalid artifact kind: ${kind}. Must be one of: form, document, checklist, bundle`,
          path: ['kind'],
        },
      ],
    }
  }

  // Get the validator for this artifact kind
  const validate = validatorMap[kind as ArtifactKind]

  // Validate using Zod validators
  const valid = validate(artifactToValidate)

  if (valid) {
    return {
      value: artifact as T,
    }
  }

  // Map errors to Standard Schema issues
  const errors = (validate as unknown as { errors: ValidatorError[] }).errors
  return {
    issues: mapErrors(errors),
  }
}

/** Artifact kinds that support logic validation */
type LogicKind = 'form' | 'bundle'

/**
 * Checks if an artifact kind supports logic validation
 */
function isLogicValidatable(kind: string): kind is LogicKind {
  return kind === 'form' || kind === 'bundle'
}

/**
 * Validates an artifact's structure and logic expressions.
 * Returns Standard Schema compliant result.
 *
 * By default, validates both schema structure and logic expressions. With
 * schema validation, an artifact that passes those checks is also checked
 * for what its layers refer to, as render and seal would find it:
 * - `defaultLayer` names a layer;
 * - each signature slot names a declared party role;
 * - a 'flow' slot is not on a PDF or DOCX layer, has type signature or initials, and
 *   is placed by a signing directive in an inline template;
 * - each party whose signature is required has a slot on every layer that
 *   declares `signatures`.
 * Use options to customize validation behavior.
 *
 * @param artifact - The artifact to validate (Form, Document, etc.)
 * @param options - Validation options
 * @returns Standard Schema Result: { value } or { issues }
 *
 * @example
 * ```typescript
 * // Full validation (default)
 * const result = validate(myForm);
 *
 * // Schema only (skip logic validation)
 * const result = validate(myForm, { logic: false });
 *
 * // Logic only (skip schema validation)
 * const result = validate(myForm, { schema: false });
 *
 * // Stop at first error
 * const result = validate(myForm, { collectAllErrors: false });
 *
 * if (result.issues) {
 *   console.error('Validation failed:', result.issues);
 * } else {
 *   console.log('Valid artifact:', result.value);
 * }
 * ```
 */
export function validate<T = unknown>(
  artifact: unknown,
  options: ValidateOptions = {}
): StandardSchemaV1.Result<T> {
  const result = validateDefinition<T>(artifact, options)
  if (result.issues || options.schema === false || !hasTemplateLayers(artifact)) return result
  const referenceIssues = validateLayerReferences(artifact)
  if (referenceIssues.length === 0) return result
  return { issues: options.collectAllErrors === false ? referenceIssues.slice(0, 1) : referenceIssues }
}

/**
 * The checks every runtime instance's definition must pass: schema
 * structure, logic expressions, and inline template expressions.
 * `validate()` adds the layer-reference checks, which seal (and render, for
 * `defaultLayer`) enforce again for the layer they use, so a definition with
 * such a problem still fills.
 */
export function validateDefinition<T = unknown>(
  artifact: unknown,
  options: ValidateOptions = {}
): StandardSchemaV1.Result<T> {
  const { schema: validateSchemaOption = true, logic = true, collectAllErrors = true } = options

  const allIssues: StandardSchemaV1.Issue[] = []

  // Step 1: Schema validation (if enabled)
  if (validateSchemaOption) {
    const schemaResult = validateSchema<T>(artifact)
    if (schemaResult.issues) {
      if (!collectAllErrors) {
        return schemaResult
      }
      allIssues.push(...schemaResult.issues)
    }
  }

  // If schema validation failed and we're collecting all errors, skip logic validation
  // because the artifact structure may be invalid
  if (allIssues.length > 0) {
    return { issues: allIssues }
  }

  // Step 2: Logic validation (if enabled and artifact supports it)
  if (logic) {
    // Need to check artifact structure for logic validation
    if (
      typeof artifact === 'object' &&
      artifact !== null &&
      'kind' in artifact &&
      typeof (artifact as { kind: unknown }).kind === 'string'
    ) {
      const kind = (artifact as { kind: string }).kind
      if (isLogicValidatable(kind)) {
        const logicResult = validateLogic(artifact as LogicValidatableArtifact, { collectAllErrors })
        if (logicResult.issues) {
          if (!collectAllErrors) {
            return { issues: logicResult.issues }
          }
          allIssues.push(...logicResult.issues)
        }
      }
    }
  }

  // Step 3: Template expressions in inline layers (with logic validation)
  if (logic && allIssues.length === 0 && hasTemplateLayers(artifact)) {
    const templateIssues = validateInlineTemplates(artifact)
    if (templateIssues.length > 0) {
      if (!collectAllErrors) return { issues: templateIssues.slice(0, 1) }
      allIssues.push(...templateIssues)
    }
  }

  // Step 4: PDF binding values name paths the form declares (with logic validation)
  if (logic && allIssues.length === 0 && hasTemplateLayers(artifact) && artifact.kind === 'form') {
    const bindingIssues = validatePdfBindingPaths(artifact as unknown as Form)
    if (bindingIssues.length > 0) {
      if (!collectAllErrors) return { issues: bindingIssues.slice(0, 1) }
      allIssues.push(...bindingIssues)
    }
  }

  if (allIssues.length > 0) {
    return { issues: allIssues }
  }

  return { value: artifact as T }
}

const TEMPLATE_KINDS = new Set(['form', 'document', 'checklist'])

function hasTemplateLayers(artifact: unknown): artifact is TemplateArtifact {
  return typeof artifact === 'object'
    && artifact !== null
    && TEMPLATE_KINDS.has(String((artifact as { kind?: unknown }).kind))
}

/** Options for {@link validateLayers}. */
export interface ValidateLayersOptions extends ValidateOptions {
  /** Reads file-backed layers, relative to the artifact. */
  resolver: Resolver
}

/**
 * The result of {@link validateLayers}: a Standard Schema result, whose issues
 * are the errors, and the warnings found alongside them. Warnings do not fail
 * validation.
 */
export type ValidateLayersResult<T> = StandardSchemaV1.Result<T> & {
  readonly warnings?: readonly LayerValidationIssue[]
}

/** A resolver that reads each path once, so the checks that share a file share one read. */
function readOnce(resolver: Resolver): Resolver {
  const reads = new Map<string, Promise<Uint8Array>>()
  return {
    read(path) {
      let read = reads.get(path)
      if (!read) {
        read = resolver.read(path)
        reads.set(path, read)
      }
      return read
    },
  }
}

/**
 * Validate an artifact and the files it refers to. `validate()` checks inline
 * layers; this also reads each file through the resolver, and a file that
 * cannot be read is an error:
 * - every file-backed layer except a React layer, whose path names a module;
 * - the `instructions` and `agentInstructions` files;
 * - the template expressions of each text and DOCX layer, and that each text
 *   template places its 'flow' signature slots;
 * - for a form, that every key of a PDF layer's bindings is an AcroForm field
 *   of its template, and that every value a binding accepts can fill its PDF
 *   text field: it fits the box at the minimum font size, and has no more
 *   characters than a comb field has boxes. A bound text field with nothing
 *   bounding its length is a warning.
 *
 * @example
 * ```typescript
 * const result = await validateLayers(form, { resolver: createFsResolver({ root: '.' }) })
 * for (const warning of result.warnings ?? []) console.warn(warning.message)
 * ```
 */
export async function validateLayers<T = unknown>(
  artifact: unknown,
  options: ValidateLayersOptions,
): Promise<ValidateLayersResult<T>> {
  const { resolver, ...validateOptions } = options
  const result = validate<T>(artifact, validateOptions)
  if (result.issues) return result
  const reader = readOnce(resolver)
  const fileIssues = await validateFileReferences(artifact, reader)
  const templateIssues = validateOptions.logic === false || !hasTemplateLayers(artifact) ? [] : await validateFileTemplates(artifact, reader)
  const pdf = hasTemplateLayers(artifact) && artifact.kind === 'form' ? await validatePdfLayers(artifact as unknown as Form, reader) : []
  const errors = [...fileIssues, ...templateIssues, ...pdf.filter((issue) => issue.severity === 'error')]
  const warnings = pdf.filter((issue) => issue.severity === 'warning')
  const outcome: StandardSchemaV1.Result<T> = errors.length > 0 ? { issues: errors } : result
  return warnings.length > 0 ? { ...outcome, warnings } : outcome
}

export const parseArtifact = (
  content: string
): Form | Document | Checklist | Bundle | undefined => {
  let parsed: unknown

  try {
    parsed = parse(content)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid artifact: ${message}`)
  }

  const result = validate(parsed)
  if (result.issues) {
    const messages = result.issues.map((issue) => {
      const path = issue.path?.length ? ` at ${issue.path.join('.')}` : ''
      return `${issue.message}${path}`
    })
    throw new Error(`Invalid artifact: ${messages.join(', ')}`)
  }

  const data = result.value as Form | Document | Checklist | Bundle

  if (data.kind === 'form') {
    return data as Form
  }
  if (data.kind === 'document') {
    return data as Document
  }
  if (data.kind === 'checklist') {
    return data as Checklist
  }
  if (data.kind === 'bundle') {
    return data as Bundle
  }

  return result.value as Form | Document | Checklist | Bundle
}
