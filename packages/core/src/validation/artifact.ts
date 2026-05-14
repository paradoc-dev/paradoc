import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { Form, Document, Checklist, Bundle } from '@paradoc/types'
import { validateLogic, type LogicValidatableArtifact } from '@/logic'
import {
  validateForm,
  validateDocument,
  validateChecklist,
  validateBundle,
} from '@/validation'

// Re-export ValidateOptions from centralized types.ts
export type { ValidateOptions } from '@/types'

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
 * Validates an artifact's schema structure only.
 * Returns Standard Schema compliant result.
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
 * By default, validates both schema structure and logic expressions.
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

  if (allIssues.length > 0) {
    return { issues: allIssues }
  }

  return { value: artifact as T }
}

export const parseArtifact = (
  content: string
): Form | Document | Checklist | Bundle | undefined => {
  const result = validate(content)
  if (result.issues) {
    throw new Error(`Invalid artifact: ${result.issues?.join(', ')}`)
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
