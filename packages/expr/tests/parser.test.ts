import { describe, expect, it } from 'vitest'

import { parse, parseOrThrow, tokenize, extractReferences } from '../src/index'
import type { Expr } from '../src/index'

/** Parse and assert no errors, returning the AST. */
function ast(src: string): Expr {
	const r = parse(src)
	expect(r.errors).toEqual([])
	expect(r.ast).not.toBeNull()
	return r.ast!
}

describe('lexer', () => {
	it('tracks 1-based line/column spans', () => {
		const toks = tokenize('fields.age >= 18')
		expect(toks[0]).toMatchObject({ type: 'identifier', value: 'fields' })
		expect(toks[0]!.span.start).toMatchObject({ line: 1, column: 1 })
		const ge = toks.find((t) => t.value === '>=')!
		expect(ge.type).toBe('operator')
		expect(ge.span.start.column).toBe(12)
	})

	it('lexes decimals, strings, keywords, and two-char operators', () => {
		const toks = tokenize('x == "a" and y != 3.5')
		const kinds = toks.map((t) => t.type)
		expect(kinds).toContain('keyword') // and
		expect(toks.find((t) => t.type === 'number')?.value).toBe('3.5')
		expect(toks.find((t) => t.type === 'string')?.value).toBe('a')
	})
})

describe('parser — precedence & associativity', () => {
	it('binds and tighter than or', () => {
		const a = ast('a or b and c') as Extract<Expr, { kind: 'Logical' }>
		expect(a.kind).toBe('Logical')
		expect(a.op).toBe('or')
		expect((a.right as Extract<Expr, { kind: 'Logical' }>).op).toBe('and')
	})

	it('binds multiplication tighter than addition', () => {
		const a = ast('1 + 2 * 3') as Extract<Expr, { kind: 'Binary' }>
		expect(a.op).toBe('+')
		expect((a.right as Extract<Expr, { kind: 'Binary' }>).op).toBe('*')
	})

	it('parses comparison and equality', () => {
		const a = ast('fields.age >= 18') as Extract<Expr, { kind: 'Binary' }>
		expect(a.kind).toBe('Binary')
		expect(a.op).toBe('>=')
		expect(a.left.kind).toBe('Member')
	})

	it('parses ternary right-associatively', () => {
		const a = ast('a ? b : c ? d : e') as Extract<Expr, { kind: 'Conditional' }>
		expect(a.kind).toBe('Conditional')
		expect((a.alternate as Extract<Expr, { kind: 'Conditional' }>).kind).toBe('Conditional')
	})
})

describe('parser — membership, calls, arrays, members', () => {
	it('parses in and not in', () => {
		const inNode = ast('x in ["a", "b"]') as Extract<Expr, { kind: 'Membership' }>
		expect(inNode.kind).toBe('Membership')
		expect(inNode.negated).toBe(false)
		const notIn = ast('x not in ["a", "b"]') as Extract<Expr, { kind: 'Membership' }>
		expect(notIn.kind).toBe('Membership')
		expect(notIn.negated).toBe(true)
	})

	it('parses calls with arguments', () => {
		const c = ast('contains(fields.tags, "x")') as Extract<Expr, { kind: 'Call' }>
		expect(c.kind).toBe('Call')
		expect(c.callee).toBe('contains')
		expect(c.args).toHaveLength(2)
	})

	it('parses zero-arg calls', () => {
		const c = ast('today()') as Extract<Expr, { kind: 'Call' }>
		expect(c.kind).toBe('Call')
		expect(c.args).toHaveLength(0)
	})

	it('parses deep member access', () => {
		const m = ast('fields.address.region') as Extract<Expr, { kind: 'Member' }>
		expect(m.kind).toBe('Member')
		expect(m.property).toBe('region')
	})

	it('parses prefix not / !', () => {
		const u = ast('not (a and b)') as Extract<Expr, { kind: 'Unary' }>
		expect(u.kind).toBe('Unary')
		expect(u.op).toBe('not')
	})

	it('parses boolean and null literals', () => {
		expect(ast('true').kind).toBe('BooleanLiteral')
		expect(ast('null').kind).toBe('NullLiteral')
	})
})

describe('parser — errors', () => {
	it('rejects = as an operator with a helpful message', () => {
		const r = parse('fields.status = "active"')
		expect(r.ast).toBeNull()
		expect(r.errors[0]!.code).toBe('forbidden-operator')
		expect(r.errors[0]!.message).toContain("'=='")
	})

	it('rejects || and &&', () => {
		expect(parse('a || b').errors[0]!.code).toBe('forbidden-operator')
		expect(parse('a && b').errors[0]!.code).toBe('forbidden-operator')
	})

	it('reports an unterminated string with a position', () => {
		const r = parse('"abc')
		expect(r.ast).toBeNull()
		expect(r.errors[0]!.code).toBe('syntax')
		expect(r.errors[0]!.span.start.line).toBe(1)
	})

	it('reports unexpected trailing input', () => {
		expect(parse('a b').errors[0]!.code).toBe('syntax')
	})

	it('rejects an empty expression', () => {
		expect(parse('   ').errors[0]!.message).toMatch(/empty/i)
	})

	it('parseOrThrow throws with position on bad input', () => {
		expect(() => parseOrThrow('a = b')).toThrow()
	})
})

describe('static reference extraction', () => {
	it('extracts identifier-rooted dotted paths', () => {
		const refs = extractReferences(ast('fields.age >= 18 and isAdult'))
		expect(refs.paths).toEqual(['fields.age', 'isAdult'])
		expect(refs.fullyStatic).toBe(true)
	})

	it('does not treat a function name as a reference', () => {
		const refs = extractReferences(ast('partyCount("buyer") > 0'))
		expect(refs.paths).toEqual([])
		expect(refs.fullyStatic).toBe(true)
	})

	it('collects references from every branch and argument', () => {
		const refs = extractReferences(ast('fields.a < 18 ? fields.b : coalesce(fields.c, fields.d)'))
		expect(refs.paths).toEqual(['fields.a', 'fields.b', 'fields.c', 'fields.d'])
	})

	it('flags dynamic index access as not fully static', () => {
		const refs = extractReferences(ast('fields.rows[fields.i].paid'))
		expect(refs.fullyStatic).toBe(false)
	})
})
