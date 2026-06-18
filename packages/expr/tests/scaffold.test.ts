import { describe, expect, it } from 'vitest'

import {
	T,
	formatType,
	typesEqual,
	buildRegistry,
	DEFAULT_SIGNATURES,
	KEYWORDS,
	BINARY_OPERATORS,
	FORBIDDEN_OPERATORS,
} from '../src/index'

describe('type system', () => {
	it('formats parameterized array types', () => {
		expect(formatType(T.array(T.string))).toBe('array<string>')
		expect(formatType(T.array(T.array(T.number)))).toBe('array<array<number>>')
		expect(formatType(T.money)).toBe('money')
	})

	it('compares types structurally', () => {
		expect(typesEqual(T.array(T.string), T.array(T.string))).toBe(true)
		expect(typesEqual(T.array(T.string), T.array(T.number))).toBe(false)
		expect(typesEqual(T.date, T.datetime)).toBe(false)
	})
})

describe('grammar config', () => {
	it('reserves the expected keywords', () => {
		expect(KEYWORDS).toContain('and')
		expect(KEYWORDS).toContain('in')
		expect(KEYWORDS).toContain('null')
	})

	it('binds `or` looser than `and` and arithmetic tighter than comparison', () => {
		const prec = (t: string) => BINARY_OPERATORS.find((o) => o.token === t)!.precedence
		expect(prec('or')).toBeLessThan(prec('and'))
		expect(prec('==')).toBeLessThan(prec('+'))
		expect(prec('+')).toBeLessThan(prec('*'))
	})

	it('rejects assignment and overloaded boolean operators', () => {
		expect(FORBIDDEN_OPERATORS['=']).toBeDefined()
		expect(FORBIDDEN_OPERATORS['||']).toBeDefined()
		expect(FORBIDDEN_OPERATORS['&&']).toBeDefined()
	})
})

describe('function registry', () => {
	const registry = buildRegistry()

	it('exposes the string, number, date, and domain functions', () => {
		for (const name of ['contains', 'isNotEmpty', 'coalesce', 'round', 'today', 'yearsBetween', 'allWitnessesSigned']) {
			expect(registry.has(name)).toBe(true)
		}
	})

	it('does not ship the deferred collection aggregates', () => {
		for (const name of ['any', 'all', 'none', 'sum', 'join', 'filter', 'map']) {
			expect(registry.has(name)).toBe(false)
		}
	})

	it('marks today/now and party functions host-injected', () => {
		expect(registry.get('today')?.hostInjected).toBe(true)
		expect(registry.get('now')?.hostInjected).toBe(true)
		expect(registry.get('partyCount')?.hostInjected).toBe(true)
		expect(registry.get('trim')?.hostInjected).toBeUndefined()
	})

	it('registers only deterministic functions', () => {
		expect(DEFAULT_SIGNATURES.every((s) => s.deterministic)).toBe(true)
	})

	it('lets host extensions override by name', () => {
		const extended = buildRegistry([
			{ name: 'partyType', category: 'domain', params: [{ name: 'roleId', type: T.string }], returns: { kind: 'fixed', type: T.string }, hostInjected: true, deterministic: true },
			{ name: 'orgScore', category: 'domain', params: [{ name: 'roleId', type: T.string }], returns: { kind: 'fixed', type: T.number }, hostInjected: true, deterministic: true },
		])
		expect(extended.has('orgScore')).toBe(true)
		expect(extended.get('orgScore')?.returns).toEqual({ kind: 'fixed', type: T.number })
	})
})
