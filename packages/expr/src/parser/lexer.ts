/**
 * Tokenizer. Turns an expression string into a flat token stream with a source
 * span on every token. Forbidden operators (`=`, `||`, `&&`) are lexed as
 * operator tokens so the parser can report them with a helpful message rather
 * than a bare "unexpected character".
 */

import type { Position, Span } from '../types'
import { KEYWORD_SET } from '../grammar/grammar'

export type TokenType =
	| 'number'
	| 'string'
	| 'identifier'
	| 'keyword'
	| 'operator'
	| 'lparen'
	| 'rparen'
	| 'lbracket'
	| 'rbracket'
	| 'comma'
	| 'dot'
	| 'question'
	| 'colon'
	| 'eof'

export interface Token {
	readonly type: TokenType
	readonly value: string
	readonly span: Span
}

export class LexError extends Error {
	constructor(
		message: string,
		readonly position: Position,
	) {
		super(message)
		this.name = 'LexError'
	}
}

const TWO_CHAR_OPERATORS = new Set(['==', '!=', '<=', '>=', '||', '&&'])

function isDigit(ch: string | undefined): boolean {
	return ch !== undefined && ch >= '0' && ch <= '9'
}

function isIdentStart(ch: string | undefined): boolean {
	return ch !== undefined && ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_')
}

function isIdentPart(ch: string | undefined): boolean {
	return isIdentStart(ch) || isDigit(ch)
}

export function tokenize(source: string): Token[] {
	const tokens: Token[] = []
	let offset = 0
	let line = 1
	let column = 1

	const pos = (): Position => ({ offset, line, column })

	const advance = (n = 1): void => {
		for (let i = 0; i < n; i++) {
			if (source[offset] === '\n') {
				line++
				column = 1
			} else {
				column++
			}
			offset++
		}
	}

	const push = (type: TokenType, value: string, start: Position): void => {
		tokens.push({ type, value, span: { start, end: pos() } })
	}

	while (offset < source.length) {
		const ch = source[offset]!

		// Whitespace
		if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
			advance()
			continue
		}

		const start = pos()

		// Number: digits with an optional fractional part
		if (isDigit(ch)) {
			let value = ''
			while (offset < source.length && isDigit(source[offset])) {
				value += source[offset]!
				advance()
			}
			if (source[offset] === '.' && isDigit(source[offset + 1])) {
				value += '.'
				advance()
				while (offset < source.length && isDigit(source[offset])) {
					value += source[offset]!
					advance()
				}
			}
			push('number', value, start)
			continue
		}

		// String: single or double quoted with backslash escapes
		if (ch === '"' || ch === "'") {
			const quote = ch
			advance()
			let value = ''
			let closed = false
			while (offset < source.length) {
				const c = source[offset]!
				if (c === '\\') {
					const next = source[offset + 1]
					value += next === undefined ? '\\' : unescape(next)
					advance(2)
					continue
				}
				if (c === quote) {
					advance()
					closed = true
					break
				}
				if (c === '\n') break
				value += c
				advance()
			}
			if (!closed) throw new LexError('Unterminated string literal', start)
			push('string', value, start)
			continue
		}

		// Identifier or keyword
		if (isIdentStart(ch)) {
			let value = ''
			while (offset < source.length && isIdentPart(source[offset])) {
				value += source[offset]!
				advance()
			}
			push(KEYWORD_SET.has(value) ? 'keyword' : 'identifier', value, start)
			continue
		}

		// Punctuation
		const single: Record<string, TokenType> = {
			'(': 'lparen',
			')': 'rparen',
			'[': 'lbracket',
			']': 'rbracket',
			',': 'comma',
			'.': 'dot',
			'?': 'question',
			':': 'colon',
		}
		const punct = single[ch]
		if (punct) {
			advance()
			push(punct, ch, start)
			continue
		}

		// Operators (two-char first, then single)
		const two = source.slice(offset, offset + 2)
		if (TWO_CHAR_OPERATORS.has(two)) {
			advance(2)
			push('operator', two, start)
			continue
		}
		if ('=<>+-*/%!'.includes(ch)) {
			advance()
			push('operator', ch, start)
			continue
		}

		throw new LexError(`Unexpected character '${ch}'`, start)
	}

	tokens.push({ type: 'eof', value: '', span: { start: pos(), end: pos() } })
	return tokens
}

function unescape(ch: string): string {
	switch (ch) {
		case 'n':
			return '\n'
		case 't':
			return '\t'
		case 'r':
			return '\r'
		default:
			return ch
	}
}
