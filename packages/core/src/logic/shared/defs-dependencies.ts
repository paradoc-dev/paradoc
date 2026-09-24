/**
 * The dependency text of each definition, for ordering and cycle detection.
 */

import type { DefsSection, Form } from '@paradoc/types'
import { rowConditionsOfExpression } from './list-paths'
import { isScalarExpressionType } from './expression-types'

/** One expression string of an object definition and its path inside the value. */
export interface DefinitionExpressionLeaf {
	readonly path: readonly string[]
	readonly expression: string
}

/**
 * Every expression string of an object definition value, depth first. Members
 * nest when the value type does, such as a bbox's `southWest.lat`; an absent
 * optional member is skipped.
 */
export function definitionExpressionLeaves(value: unknown, path: readonly string[] = []): DefinitionExpressionLeaf[] {
	if (typeof value === 'string') return [{ path, expression: value }]
	if (typeof value !== 'object' || value === null) return []
	return Object.entries(value).flatMap(([key, member]) => definitionExpressionLeaves(member, [...path, key]))
}

/**
 * One parseable expression per definition key holding everything it depends
 * on. A scalar definition is its value; an object definition joins its
 * property expressions with `and`. A definition that reads list rows also
 * depends on the `visible` conditions that hide those rows, so they are
 * joined in when `fields` is given.
 */
export function defsDependencyExpressions(defs: DefsSection, fields?: Form['fields']): Record<string, string> {
	const result: Record<string, string> = {}
	for (const [key, expr] of Object.entries(defs)) {
		const expressions = isScalarExpressionType(expr.type)
			? [expr.value as string]
			: definitionExpressionLeaves(expr.value).map((leaf) => leaf.expression)
		const rowConditions = fields ? expressions.flatMap((expression) => rowConditionsOfExpression(fields, expression)) : []
		result[key] = [...expressions, ...rowConditions].map((expression) => `(${expression})`).join(' and ')
	}
	return result
}
