/**
 * Whether an expression's value is one scalar string expression or an
 * object of nested ones. The scalar type list comes from `@paradoc/schemas`,
 * the single source of truth for which expression types exist.
 */

import { SCALAR_EXPRESSION_TYPES as SCHEMA_SCALAR_EXPRESSION_TYPES } from '@paradoc/schemas'
import type { ScalarExpressionType } from '@paradoc/types'

/** Scalar expression types (value is a single string expression). */
export const SCALAR_EXPRESSION_TYPES: ReadonlySet<string> = new Set(SCHEMA_SCALAR_EXPRESSION_TYPES)

/** Whether an expression type's value is a scalar (not an object of nested expressions). */
export function isScalarExpressionType(type: string): type is ScalarExpressionType {
	return SCALAR_EXPRESSION_TYPES.has(type)
}
