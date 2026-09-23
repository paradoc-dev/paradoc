/**
 * The dependency text of each definition, for ordering and cycle detection.
 */

import type { DefsSection, Form } from '@paradoc/types'
import { rowConditionsOfExpression } from './list-paths'

const SCALAR_EXPRESSION_TYPES: ReadonlySet<string> = new Set([
	'boolean',
	'string',
	'number',
	'integer',
	'percentage',
	'rating',
	'date',
	'time',
	'datetime',
	'duration',
])

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
		const expressions = SCALAR_EXPRESSION_TYPES.has(expr.type)
			? [expr.value as string]
			: Object.values(expr.value as unknown as Record<string, string | undefined>).filter(
					(value): value is string => value !== undefined,
				)
		const rowConditions = fields ? expressions.flatMap((expression) => rowConditionsOfExpression(fields, expression)) : []
		result[key] = [...expressions, ...rowConditions].map((expression) => `(${expression})`).join(' and ')
	}
	return result
}
