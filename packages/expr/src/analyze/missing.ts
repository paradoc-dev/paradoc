/**
 * Missing inputs: which of an expression's references have no value in a
 * context. A reference is missing when its path reaches null or an absent
 * member, including through the rows of a list (`fields.items.amount` is
 * missing when any row has no amount). A present value of the wrong shape is
 * not missing; reading a member of it is a type question, not an absent input.
 * Neither is a root the context does not define, such as a misspelled name.
 *
 * The evaluator uses this to tell an expression that cannot be computed yet
 * from one that fails with every input present.
 */

import type { Expr } from '../ast/nodes'
import type { EvaluationContext } from '../eval/context'
import { NULL, type Value } from '../eval/values'
import { extractReferences } from './references'

/**
 * Whether a dotted path reaches no value, fanning out over every list it
 * passes through. A root the context does not know is not an input at all, so
 * it is never missing: reading it is an authoring error.
 */
function isMissingPath(path: string, ctx: EvaluationContext): boolean {
	const [root, ...members] = path.split('.')
	const rootValue = ctx.lookup(root!)
	if (rootValue === undefined) return false
	let values: Value[] = [rootValue]
	for (const member of members) {
		const next: Value[] = []
		for (const value of values) {
			if (value.kind === 'null') return true
			if (value.kind === 'object') next.push(value.value.get(member) ?? NULL)
			else if (value.kind === 'array') {
				for (const row of value.value) {
					if (row.kind === 'null') return true
					if (row.kind === 'object') next.push(row.value.get(member) ?? NULL)
				}
			}
		}
		values = next
	}
	return values.some((value) => value.kind === 'null')
}

/** The expression's references that have no value in `ctx`, sorted. */
export function missingReferences(ast: Expr, ctx: EvaluationContext): string[] {
	return extractReferences(ast).paths.filter((path) => isMissingPath(path, ctx))
}
