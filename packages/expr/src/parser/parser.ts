/**
 * Recursive-descent / precedence-climbing parser. Consumes the token stream and
 * the pure-data grammar config to produce the typed AST. Reports a single,
 * positioned syntax error (good messages over multi-error recovery for v1),
 * including helpful diagnostics for the deliberately rejected operators.
 */

import type { Diagnostic, Span } from '../types'
import type {
	Expr,
	BinaryOp,
	ComparisonOp,
	ArithmeticOp,
} from '../ast/nodes'
import { BINARY_OPERATORS, FORBIDDEN_OPERATORS, type OperatorInfo } from '../grammar/grammar'
import { tokenize, LexError, type Token } from './lexer'

export interface ParseResult {
	readonly ast: Expr | null
	readonly errors: readonly Diagnostic[]
}

class ParseError extends Error {
	constructor(readonly diagnostic: Diagnostic) {
		super(diagnostic.message)
		this.name = 'ParseError'
	}
}

const OPERATOR_INFO: ReadonlyMap<string, OperatorInfo> = new Map(
	BINARY_OPERATORS.map((o) => [o.token, o]),
)

const ARITHMETIC = new Set<string>(['+', '-', '*', '/', '%'])
const COMPARISON = new Set<string>(['==', '!=', '<', '<=', '>', '>='])

function spanBetween(a: Span, b: Span): Span {
	return { start: a.start, end: b.end }
}

class Parser {
	private pos = 0

	constructor(private readonly tokens: readonly Token[]) {}

	private peek(ahead = 0): Token {
		return this.tokens[Math.min(this.pos + ahead, this.tokens.length - 1)]!
	}

	private next(): Token {
		const t = this.tokens[this.pos]!
		if (this.pos < this.tokens.length - 1) this.pos++
		return t
	}

	private fail(message: string, span: Span, code: Diagnostic['code'] = 'syntax'): never {
		throw new ParseError({ severity: 'error', code, message, span })
	}

	parse(): Expr {
		if (this.peek().type === 'eof') {
			this.fail('Empty expression', this.peek().span)
		}
		const expr = this.parseExpression()
		const tok = this.peek()
		if (tok.type !== 'eof') {
			const forbidden = FORBIDDEN_OPERATORS[tok.value]
			if (forbidden) this.fail(forbidden, tok.span, 'forbidden-operator')
			this.fail(`Unexpected '${tok.value || 'end of input'}'`, tok.span)
		}
		return expr
	}

	private parseExpression(): Expr {
		return this.parseTernary()
	}

	private parseTernary(): Expr {
		const test = this.parseBinary(0)
		if (this.peek().type === 'question') {
			this.next()
			const consequent = this.parseExpression()
			if (this.peek().type !== 'colon') {
				this.fail("Expected ':' in ternary expression", this.peek().span)
			}
			this.next()
			const alternate = this.parseExpression()
			return {
				kind: 'Conditional',
				test,
				consequent,
				alternate,
				span: spanBetween(test.span, alternate.span),
			}
		}
		return test
	}

	/** Precedence climbing, with `not in` and forbidden-operator handling. */
	private parseBinary(minPrec: number): Expr {
		let left = this.parseUnary()
		for (;;) {
			const tok = this.peek()

			// `not in`
			if (tok.type === 'keyword' && tok.value === 'not' && this.peek(1).value === 'in') {
				const info = OPERATOR_INFO.get('in')!
				if (info.precedence < minPrec) break
				this.next() // not
				this.next() // in
				const right = this.parseBinary(info.precedence + 1)
				left = {
					kind: 'Membership',
					negated: true,
					element: left,
					collection: right,
					span: spanBetween(left.span, right.span),
				}
				continue
			}

			const forbidden = FORBIDDEN_OPERATORS[tok.value]
			if (forbidden && (tok.type === 'operator' || tok.type === 'keyword')) {
				this.fail(forbidden, tok.span, 'forbidden-operator')
			}

			const info = OPERATOR_INFO.get(tok.value)
			if (!info || (tok.type !== 'operator' && tok.type !== 'keyword') || info.precedence < minPrec) {
				break
			}
			this.next()
			const nextMin = info.associativity === 'left' ? info.precedence + 1 : info.precedence
			const right = this.parseBinary(nextMin)
			left = this.makeBinary(info.token, left, right)
		}
		return left
	}

	private makeBinary(op: string, left: Expr, right: Expr): Expr {
		const span = spanBetween(left.span, right.span)
		if (op === 'and' || op === 'or') {
			return { kind: 'Logical', op, left, right, span }
		}
		if (op === 'in') {
			return { kind: 'Membership', negated: false, element: left, collection: right, span }
		}
		if (ARITHMETIC.has(op) || COMPARISON.has(op)) {
			return { kind: 'Binary', op: op as BinaryOp | ComparisonOp | ArithmeticOp, left, right, span }
		}
		this.fail(`Unknown operator '${op}'`, span)
	}

	private parseUnary(): Expr {
		const tok = this.peek()
		const isNot = tok.type === 'keyword' && tok.value === 'not'
		const isBang = tok.type === 'operator' && tok.value === '!'
		const isNeg = tok.type === 'operator' && tok.value === '-'
		if (isNot || isBang || isNeg) {
			this.next()
			const operand = this.parseUnary()
			return {
				kind: 'Unary',
				op: isNeg ? 'neg' : 'not',
				operand,
				span: spanBetween(tok.span, operand.span),
			}
		}
		return this.parsePostfix()
	}

	private parsePostfix(): Expr {
		let expr = this.parsePrimary()
		for (;;) {
			const tok = this.peek()
			if (tok.type === 'dot') {
				this.next()
				const prop = this.peek()
				if (prop.type !== 'identifier') {
					this.fail('Expected a property name after "."', prop.span)
				}
				this.next()
				expr = { kind: 'Member', object: expr, property: prop.value, span: spanBetween(expr.span, prop.span) }
				continue
			}
			if (tok.type === 'lbracket') {
				this.next()
				const index = this.parseExpression()
				const close = this.peek()
				if (close.type !== 'rbracket') this.fail('Expected "]"', close.span)
				this.next()
				expr = { kind: 'Index', object: expr, index, span: spanBetween(expr.span, close.span) }
				continue
			}
			break
		}
		return expr
	}

	private parsePrimary(): Expr {
		const tok = this.peek()
		switch (tok.type) {
			case 'number':
				this.next()
				return { kind: 'NumberLiteral', value: tok.value, span: tok.span }
			case 'string':
				this.next()
				return { kind: 'StringLiteral', value: tok.value, span: tok.span }
			case 'keyword':
				if (tok.value === 'true' || tok.value === 'false') {
					this.next()
					return { kind: 'BooleanLiteral', value: tok.value === 'true', span: tok.span }
				}
				if (tok.value === 'null') {
					this.next()
					return { kind: 'NullLiteral', span: tok.span }
				}
				this.fail(`Unexpected keyword '${tok.value}'`, tok.span)
				break
			case 'identifier': {
				this.next()
				if (this.peek().type === 'lparen') {
					return this.parseCall(tok.value, tok.span)
				}
				return { kind: 'Identifier', name: tok.value, span: tok.span }
			}
			case 'lparen': {
				this.next()
				const inner = this.parseExpression()
				const close = this.peek()
				if (close.type !== 'rparen') this.fail('Expected ")"', close.span)
				this.next()
				return inner
			}
			case 'lbracket':
				return this.parseArrayLiteral(tok.span)
			default: {
				const forbidden = FORBIDDEN_OPERATORS[tok.value]
				if (forbidden) this.fail(forbidden, tok.span, 'forbidden-operator')
				this.fail(`Unexpected '${tok.value || 'end of input'}'`, tok.span)
			}
		}
	}

	private parseCall(callee: string, calleeSpan: Span): Expr {
		this.next() // (
		const args: Expr[] = []
		if (this.peek().type !== 'rparen') {
			for (;;) {
				args.push(this.parseExpression())
				if (this.peek().type === 'comma') {
					this.next()
					continue
				}
				break
			}
		}
		const close = this.peek()
		if (close.type !== 'rparen') this.fail('Expected ")" to close arguments', close.span)
		this.next()
		return { kind: 'Call', callee, args, span: spanBetween(calleeSpan, close.span) }
	}

	private parseArrayLiteral(openSpan: Span): Expr {
		this.next() // [
		const elements: Expr[] = []
		if (this.peek().type !== 'rbracket') {
			for (;;) {
				elements.push(this.parseExpression())
				if (this.peek().type === 'comma') {
					this.next()
					continue
				}
				break
			}
		}
		const close = this.peek()
		if (close.type !== 'rbracket') this.fail('Expected "]" to close array', close.span)
		this.next()
		return { kind: 'ArrayLiteral', elements, span: spanBetween(openSpan, close.span) }
	}
}

/** Parse an expression string into an AST, collecting a syntax error if any. */
export function parse(source: string): ParseResult {
	try {
		const tokens = tokenize(source)
		const ast = new Parser(tokens).parse()
		return { ast, errors: [] }
	} catch (e) {
		if (e instanceof ParseError) {
			return { ast: null, errors: [e.diagnostic] }
		}
		if (e instanceof LexError) {
			const span = { start: e.position, end: e.position }
			return { ast: null, errors: [{ severity: 'error', code: 'syntax', message: e.message, span }] }
		}
		throw e
	}
}

/** Parse, throwing on the first error. Convenience for callers that expect valid input. */
export function parseOrThrow(source: string): Expr {
	const { ast, errors } = parse(source)
	if (!ast) {
		const first = errors[0]
		throw new Error(first ? `${first.message} (at ${first.span.start.line}:${first.span.start.column})` : 'Parse failed')
	}
	return ast
}
