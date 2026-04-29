/**
 * Logic Validation Module (Internal)
 *
 * Most exports here are internal implementation details.
 * Public API exports only validateLogic() and LogicValidatableArtifact.
 *
 * @internal
 */

import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { Form, Bundle } from '@paradoc/types'
import { validateFormDefs } from './validate-form-logic'
import { validateBundleDefs } from './validate-bundle-logic'

// Re-export types and utilities (internal use only)
export { parseExpression, validateExpressionSyntax, type ParseResult } from './expression-parser'
export { collectFieldPaths, collectFieldIds } from './field-paths'
export { validateFormDefs, type LogicValidationOptions, type LogicValidationIssue } from './validate-form-logic'
export { validateBundleDefs } from './validate-bundle-logic'
export { isInlineBundleArtifact, isFormArtifact, isBundleArtifact } from './shared'

/** Artifacts that support logic validation */
export type LogicValidatableArtifact = Form | Bundle

/**
 * Options for logic validation
 */
export interface ValidateLogicOptions {
  /** Whether to collect all errors or stop at first. Default: true */
  collectAllErrors?: boolean
}

/**
 * Validates all logic expressions in an artifact.
 *
 * Supports Form and Bundle artifacts. For each:
 * - Validates expression syntax using expr-eval-fork parser
 * - Validates that variable references exist (for inline artifacts only)
 * - Recursively validates nested inline artifacts
 *
 * For slug/path references, only syntax is validated (variable references cannot be checked
 * because the artifact definition is not available).
 *
 * @param artifact - The artifact to validate (Form or Bundle)
 * @param options - Validation options
 * @returns Standard Schema result: { value } on success, { issues } on failure
 *
 * @example
 * ```typescript
 * import { validateLogic } from '@paradoc/core'
 *
 * const form: Form = {
 *   kind: 'form',
 *   name: 'test',
 *   version: '1.0',
 *   title: 'Test',
 *   logic: {
 *     isAdult: 'fields.age >= 18'
 *   },
 *   fields: {
 *     age: { type: 'number' },
 *     consent: { type: 'boolean', visible: 'isAdult' }
 *   }
 * }
 *
 * const result = validateLogic(form)
 * if (result.issues) {
 *   console.error('Validation errors:', result.issues)
 * } else {
 *   console.log('Valid artifact:', result.value)
 * }
 * ```
 */
export function validateLogic<T extends LogicValidatableArtifact>(
  artifact: T,
  options: ValidateLogicOptions = {}
): StandardSchemaV1.Result<T> {
  switch (artifact.kind) {
    case 'form':
      return validateFormDefs(artifact as Form, options) as StandardSchemaV1.Result<T>
    case 'bundle':
      return validateBundleDefs(artifact as Bundle, options) as StandardSchemaV1.Result<T>
    default:
      // This should never happen if TypeScript types are correct
      return {
        issues: [
          {
            message: `Unsupported artifact kind for logic validation: ${(artifact as { kind: string }).kind}`,
            path: ['kind'],
          },
        ],
      }
  }
}
