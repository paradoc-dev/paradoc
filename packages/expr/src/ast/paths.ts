/**
 * Static reference paths. A path is an identifier-rooted member chain such as
 * `fields.items.amount`; anything else (an index, a call result) has none.
 */

import type { Expr } from './nodes'

/** The dotted path of an identifier-rooted member chain, or null if not static. */
export function staticPath(node: Expr): string | null {
	if (node.kind === 'Identifier') return node.name
	if (node.kind === 'Member') {
		const base = staticPath(node.object)
		return base === null ? null : `${base}.${node.property}`
	}
	return null
}
