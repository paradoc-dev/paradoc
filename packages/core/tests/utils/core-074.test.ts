/**
 * core-074: assertSafePattern and isSafePattern report regex syntax errors as ReDoS.
 * Input: '(abc', '[a-', 'a{2,1}' (all fail `new RegExp`).
 * Expected: reason 'invalid' ("syntax error").
 * Actual: reason 'redos' ("ReDoS vulnerability detected"), because safeRegex runs first
 *   and returns false for a pattern it cannot parse.
 */
import { describe, test, expect } from 'vitest'
import { assertSafePattern, isSafePattern, UnsafePatternError } from '@/utils/safe-pattern'

describe('core-074', () => {
	test.each(['(abc', '[a-', 'a{2,1}'])('%s is a syntax error, not ReDoS', (pattern) => {
		expect(() => new RegExp(pattern)).toThrow(SyntaxError)
		expect(isSafePattern(pattern).reason).toBe('invalid')
		let err: UnsafePatternError | undefined
		try { assertSafePattern(pattern) } catch (e) { err = e as UnsafePatternError }
		expect(err?.reason).toBe('invalid')
	})
})
