import type { StandardSchemaV1 } from '@standard-schema/spec'
import type {
  Bundle,
  BundleContentItem,
  CondExpr,
} from '@paradoc/types'
import { createTypeEnv } from '@paradoc/expr'
import { parseExpression } from './expression-parser'
import { validateFormDefs } from './validate-form-logic'
import { buildBundleTypeAcc } from '../type-checking'
import {
  isInlineBundleArtifact,
  isFormArtifact,
  isBundleArtifact,
  unknownVariableMessage,
  validateReservedDefinitionNames,
  validateDefsSection,
  typeCheckBooleanExpression,
  typeCheckDefsExpressions,
  type LogicValidationIssue,
  type LogicValidationOptions,
} from './shared'
import { defsDependencyExpressions } from '../../shared/defs-dependencies'

/**
 * Validates all defs expressions in a Bundle artifact.
 *
 * Checks:
 * 1. Expression syntax using the @paradoc/expr parser
 * 2. Variable references exist: definitions against the bundle's reference
 *    paths, and include conditions on inline items
 * 3. Definitions have no dependency cycle
 * 4. Recursively validates inline form and bundle artifacts
 * 5. Definitions return their declared type, and include conditions return boolean
 *
 * For slug/path references, only syntax is validated (variable references cannot be checked
 * because the artifact definition is not available).
 *
 * @param bundle - The Bundle artifact to validate
 * @param options - Validation options
 * @returns Standard Schema result: { value } on success, { issues } on failure
 *
 * @example
 * ```typescript
 * const bundle: Bundle = {
 *   kind: 'bundle',
 *   name: 'test',
 *   version: '1.0.0',
 *   title: 'Test',
 *   defs: {
 *     needsForm: {
 *       type: 'boolean',
 *       value: 'forms.main.fields.required == true'
 *     }
 *   },
 *   contents: [
 *     { type: 'inline', key: 'main', artifact: { kind: 'form', ... } },
 *     { type: 'registry', key: 'optional', slug: '@org/optional', include: 'needsForm' }
 *   ]
 * }
 *
 * validateBundleDefs(bundle)
 * ```
 */
export function validateBundleDefs(
  bundle: Bundle,
  options: LogicValidationOptions = {}
): StandardSchemaV1.Result<Bundle> {
  const { collectAllErrors = true } = options
  const issues: LogicValidationIssue[] = []

  // The valid variables are the reference paths of the bundle's type
  // environment: its definitions and every inline artifact's paths.
  const referenceTypes = buildBundleTypeAcc(bundle)
  const validVariables = new Set(Object.keys(referenceTypes))

  if (!validateReservedDefinitionNames(bundle.defs, issues, collectAllErrors)) {
    return { issues }
  }

  // Validate defs section expressions and dependency cycles
  if (
    bundle.defs &&
    !validateDefsSection(bundle.defs, defsDependencyExpressions(bundle.defs), validVariables, issues, collectAllErrors)
  ) {
    return { issues }
  }

  // Validate include conditions on content items
  for (let i = 0; i < bundle.contents.length; i++) {
    const item = bundle.contents[i]
    if (!item) continue
    const itemPath = ['contents', i]

    // Get include expression based on content item type
    const include = getIncludeExpression(item)

    // Validate include expression syntax (always)
    if (typeof include === 'string') {
      const parseResult = parseExpression(include)
      if (!parseResult.success) {
        issues.push({
          message: `Syntax error: ${parseResult.error}`,
          path: [...itemPath, 'include'],
          expression: include,
        })
        if (!collectAllErrors) {
          return { issues }
        }
      } else {
        // For inline artifacts, validate variable references
        // For slug/path, skip variable validation (artifact not available)
        if (isInlineBundleArtifact(item)) {
          for (const variable of parseResult.variables) {
            if (!validVariables.has(variable)) {
              issues.push({
                message: unknownVariableMessage(variable, validVariables),
                path: [...itemPath, 'include'],
                expression: include,
                variable,
              })
              if (!collectAllErrors) {
                return { issues }
              }
            }
          }
        }
        // For slug/path references - skip variable validation silently
      }
    }

    // Recursively validate inline Form artifacts
    if (isInlineBundleArtifact(item)) {
      if (isFormArtifact(item.artifact)) {
        const formResult = validateFormDefs(item.artifact, options)
        if (formResult.issues) {
          // Prefix the path with contents[i].artifact
          for (const issue of formResult.issues) {
            const logicIssue = issue as LogicValidationIssue
            issues.push({
              ...logicIssue,
              path: [...itemPath, 'artifact', ...logicIssue.path],
            })
          }
          if (!collectAllErrors) {
            return { issues }
          }
        }
      } else if (isBundleArtifact(item.artifact)) {
        // Recursively validate nested bundles
        const bundleResult = validateBundleDefs(item.artifact, options)
        if (bundleResult.issues) {
          for (const issue of bundleResult.issues) {
            const logicIssue = issue as LogicValidationIssue
            issues.push({
              ...logicIssue,
              path: [...itemPath, 'artifact', ...logicIssue.path],
            })
          }
          if (!collectAllErrors) {
            return { issues }
          }
        }
      }
    }
  }

  // Phase 2: Type checking of definitions and include expressions
  // Only proceed if syntax and variable validation passed (or collecting all errors)
  if (collectAllErrors || issues.length === 0) {
    const typeEnv = createTypeEnv(referenceTypes)

    if (!typeCheckDefsExpressions(bundle.defs, typeEnv, issues, collectAllErrors)) {
      return { issues }
    }

    for (let i = 0; i < bundle.contents.length; i++) {
      const item = bundle.contents[i]
      if (!item) continue
      if (!typeCheckBooleanExpression(getIncludeExpression(item), ['contents', i, 'include'], typeEnv, issues, collectAllErrors)) {
        return { issues }
      }
    }
  }

  return issues.length > 0 ? { issues } : { value: bundle }
}

/**
 * Helper to get include expression from a BundleContentItem.
 * Every reference kind supports the same optional condition.
 */
function getIncludeExpression(item: BundleContentItem): CondExpr | undefined {
	return item.include
}
