/**
 * Pure-data grammar configuration: the keyword set, the binary operator
 * precedence and associativity table, and the rejected operators. The lexer
 * and parser read it; the unary operators are parsed directly.
 */

/** Reserved words that are never parsed as identifiers. */
export const KEYWORDS = ['and', 'or', 'not', 'in', 'true', 'false', 'null'] as const
export type Keyword = (typeof KEYWORDS)[number]

export type Associativity = 'left' | 'right'

export interface OperatorInfo {
	readonly token: string
	readonly precedence: number
	readonly associativity: Associativity
}

/**
 * Binary, logical, and membership operators by binding power (higher binds
 * tighter). Precedence ladder, loosest to tightest:
 *   or < and < equality < comparison < membership < additive < multiplicative.
 * Unary operators bind tighter than any binary; the ternary `? :` is the
 * loosest construct and is handled directly by the parser.
 *
 * `not in` is lexed as the `in` operator with a preceding `not`; the parser
 * folds it into a negated Membership node.
 */
export const BINARY_OPERATORS: readonly OperatorInfo[] = [
	{ token: 'or', precedence: 1, associativity: 'left' },
	{ token: 'and', precedence: 2, associativity: 'left' },
	{ token: '==', precedence: 3, associativity: 'left' },
	{ token: '!=', precedence: 3, associativity: 'left' },
	{ token: '<', precedence: 4, associativity: 'left' },
	{ token: '<=', precedence: 4, associativity: 'left' },
	{ token: '>', precedence: 4, associativity: 'left' },
	{ token: '>=', precedence: 4, associativity: 'left' },
	{ token: 'in', precedence: 5, associativity: 'left' },
	{ token: '+', precedence: 6, associativity: 'left' },
	{ token: '-', precedence: 6, associativity: 'left' },
	{ token: '*', precedence: 7, associativity: 'left' },
	{ token: '/', precedence: 7, associativity: 'left' },
	{ token: '%', precedence: 7, associativity: 'left' },
]

/**
 * Operators the language deliberately rejects, mapped to the message the
 * checker surfaces. `=` is assignment (a `==` typo); `||` / `&&` are the
 * dropped overloaded forms.
 */
export const FORBIDDEN_OPERATORS: Readonly<Record<string, string>> = {
	'=': "Use '==' for equality; '=' (assignment) is not allowed.",
	'||': "Use 'or' for logic and '+' to concatenate strings; '||' is not supported.",
	'&&': "Use 'and'; '&&' is not supported.",
}

/** Fast membership lookup for the lexer/parser. */
export const KEYWORD_SET: ReadonlySet<string> = new Set(KEYWORDS)
