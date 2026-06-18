import { describe, expect, it } from 'vitest'

import { check, checkBooleanGate, createTypeEnv, T } from '../src/index'
import type { TypeEnv } from '../src/index'

const env: TypeEnv = createTypeEnv({
	fields: T.object,
	'fields.age': T.number,
	'fields.name': T.string,
	'fields.dob': T.date,
	'fields.tags': T.array(T.string),
	'fields.rent': T.money,
	'fields.rent.amount': T.number,
	isAdult: T.boolean,
})

const codes = (src: string) => check(src, env).diagnostics.map((d) => d.code)

describe('checker — clean expressions', () => {
	it('accepts well-typed gates', () => {
		expect(check('fields.age >= 18', env).diagnostics).toEqual([])
		expect(check('isAdult and fields.age > 21', env).diagnostics).toEqual([])
		expect(check('fields.name in ["a", "b"]', env).diagnostics).toEqual([])
		expect(check('startsWith(fields.name, "A")', env).diagnostics).toEqual([])
	})

	it('infers result types', () => {
		expect(check('fields.age + 1', env).type).toEqual(T.number)
		expect(check('fields.name + "!"', env).type).toEqual(T.string)
		expect(check('fields.age >= 18', env).type).toEqual(T.boolean)
		expect(check('yearsBetween(fields.dob, today())', env).type).toEqual(T.number)
	})
})

describe('checker — catches mistakes at authoring time', () => {
	it('flags unknown references', () => {
		expect(codes('fields.nope > 1')).toContain('unknown-identifier')
	})

	it('flags unknown functions', () => {
		expect(codes('frobnicate(fields.age)')).toContain('unknown-function')
	})

	it('flags arity mismatches', () => {
		expect(codes('startsWith(fields.name)')).toContain('arity')
	})

	it('flags argument type mismatches', () => {
		expect(codes('startsWith(fields.age, "9")')).toContain('type-mismatch')
	})

	it('flags ordering of incompatible types', () => {
		expect(codes('fields.name < fields.age')).toContain('type-mismatch')
	})

	it('flags arithmetic on non-numbers', () => {
		expect(codes('fields.name * 2')).toContain('type-mismatch')
	})

	it('propagates syntax errors (forbidden operators) as diagnostics', () => {
		expect(codes('fields.age = 18')).toContain('forbidden-operator')
	})
})

describe('checker — boolean gate context', () => {
	it('accepts a boolean result', () => {
		expect(checkBooleanGate('fields.age >= 18', env).diagnostics).toEqual([])
	})

	it('rejects a non-boolean gate', () => {
		expect(checkBooleanGate('fields.age', env).diagnostics.map((d) => d.code)).toContain('non-boolean-gate')
	})

	it('allows member/money access typed correctly', () => {
		expect(check('fields.rent.amount > 1000', env).diagnostics).toEqual([])
	})
})
