/**
 * Static reference extraction. Walks an AST and returns the set of value
 * references it depends on, as dotted paths rooted at a bare identifier
 * (`fields.age`, `fields.unitPrice.amount`, `isAdult`).
 *
 * This is the load-bearing guarantee behind the dependency-aware fill state in
 * @paradoc/core: gate expressions must expose their field/defs references
 * completely and cheaply. `fullyStatic` is false when a reference path passes
 * through a dynamic segment (an index expression), which the DAG cannot resolve
 * statically; such expressions must be rejected or handled explicitly upstream.
 */

import type { Expr } from '../ast/nodes'

export interface References {
	/** Dotted paths rooted at an identifier, sorted and de-duplicated. */
	readonly paths: readonly string[]
	/** False if any reference path passes through a dynamic (index) segment. */
	readonly fullyStatic: boolean
}

/** The dotted path of an identifier-rooted member chain, or null if not static. */
function staticPath(node: Expr): string | null {
	if (node.kind === 'Identifier') return node.name
	if (node.kind === 'Member') {
		const base = staticPath(node.object)
		return base === null ? null : `${base}.${node.property}`
	}
	return null
}

export function extractReferences(ast: Expr): References {
	const paths = new Set<string>()
	let fullyStatic = true

	const visit = (node: Expr): void => {
		switch (node.kind) {
			case 'Identifier':
				paths.add(node.name)
				return
			case 'Member': {
				const path = staticPath(node)
				if (path !== null) {
					paths.add(path)
				} else {
					// Base is not a static chain (e.g. a call or index result).
					visit(node.object)
				}
				return
			}
			case 'Index':
				// Indexing makes the resulting path non-static.
				fullyStatic = false
				visit(node.object)
				visit(node.index)
				return
			case 'Unary':
				visit(node.operand)
				return
			case 'Binary':
			case 'Logical':
				visit(node.left)
				visit(node.right)
				return
			case 'Membership':
				visit(node.element)
				visit(node.collection)
				return
			case 'Conditional':
				visit(node.test)
				visit(node.consequent)
				visit(node.alternate)
				return
			case 'Call':
				for (const arg of node.args) visit(arg)
				return
			case 'ArrayLiteral':
				for (const el of node.elements) visit(el)
				return
			case 'NumberLiteral':
			case 'StringLiteral':
			case 'BooleanLiteral':
			case 'NullLiteral':
				return
		}
	}

	visit(ast)
	return { paths: [...paths].sort(), fullyStatic }
}
