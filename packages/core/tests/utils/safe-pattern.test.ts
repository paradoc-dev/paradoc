import { describe, it, expect } from 'vitest'
import {
	assertSafePattern,
	isSafePattern,
	createSafeRegex,
	UnsafePatternError,
} from '../../src/utils/safe-pattern'

describe('safe-pattern', () => {
	describe('assertSafePattern', () => {
		it('should accept safe patterns', () => {
			expect(() => assertSafePattern('^[a-z]+$')).not.toThrow()
			expect(() => assertSafePattern('[0-9]{3}-[0-9]{4}')).not.toThrow()
			expect(() => assertSafePattern('^\\d{2}/\\d{2}/\\d{4}$')).not.toThrow()
			expect(() => assertSafePattern('^[A-Z][a-z]*$')).not.toThrow()
		})

		it('should reject known ReDoS patterns', () => {
			// Classic ReDoS: nested quantifiers detected by safe-regex
			expect(() => assertSafePattern('^(a+)+$')).toThrow(UnsafePatternError)
			expect(() => assertSafePattern('^(a*)*$')).toThrow(UnsafePatternError)

			// Evil regex patterns
			expect(() => assertSafePattern('(a+)+b')).toThrow(UnsafePatternError)
			expect(() => assertSafePattern('([a-zA-Z]+)*')).toThrow(UnsafePatternError)
		})

		it('should reject patterns that are too long', () => {
			const longPattern = 'a'.repeat(501)
			expect(() => assertSafePattern(longPattern)).toThrow(UnsafePatternError)

			const error = (() => {
				try {
					assertSafePattern(longPattern)
				} catch (e) {
					return e as UnsafePatternError
				}
			})()

			expect(error?.reason).toBe('too_long')
		})

		it('should reject patterns that safe-regex flags as unsafe', () => {
			// safe-regex may flag some patterns as unsafe even if they have syntax errors
			// The key is that they get rejected
			expect(() => assertSafePattern('[invalid')).toThrow(UnsafePatternError)
		})

		it('should include field name in error message when provided', () => {
			expect(() => assertSafePattern('^(a+)+$', 'email')).toThrow(
				/field "email"/
			)
		})
	})

	describe('isSafePattern', () => {
		it('should return safe: true for valid patterns', () => {
			expect(isSafePattern('^[a-z]+$')).toEqual({ safe: true })
			expect(isSafePattern('[0-9]+')).toEqual({ safe: true })
		})

		it('should return safe: false with reason for ReDoS patterns', () => {
			const result = isSafePattern('^(a+)+$')
			expect(result.safe).toBe(false)
			expect(result.reason).toBe('redos')
			expect(result.message).toContain('ReDoS')
		})

		it('should return safe: false with reason for too long patterns', () => {
			const result = isSafePattern('a'.repeat(501))
			expect(result.safe).toBe(false)
			expect(result.reason).toBe('too_long')
			expect(result.message).toContain('maximum length')
		})

		it('should return safe: false for patterns flagged by safe-regex', () => {
			// safe-regex flags patterns it considers unsafe
			const result = isSafePattern('[invalid')
			expect(result.safe).toBe(false)
			// The reason might be 'redos' if safe-regex flags it before we check syntax
		})
	})

	describe('createSafeRegex', () => {
		it('should return RegExp for safe patterns', () => {
			const regex = createSafeRegex('^[a-z]+$')
			expect(regex).toBeInstanceOf(RegExp)
			expect(regex.test('abc')).toBe(true)
			expect(regex.test('123')).toBe(false)
		})

		it('should support regex flags', () => {
			const regex = createSafeRegex('^[a-z]+$', 'i')
			expect(regex.test('ABC')).toBe(true)
		})

		it('should throw for unsafe patterns', () => {
			expect(() => createSafeRegex('^(a+)+$')).toThrow(UnsafePatternError)
		})
	})

	describe('UnsafePatternError', () => {
		it('should have correct properties', () => {
			const error = new UnsafePatternError('test message', '^(a+)+$', 'redos')
			expect(error.name).toBe('UnsafePatternError')
			expect(error.message).toBe('test message')
			expect(error.pattern).toBe('^(a+)+$')
			expect(error.reason).toBe('redos')
		})
	})

	describe('edge cases', () => {
		it('should handle empty pattern', () => {
			// Empty pattern is valid regex
			expect(isSafePattern('')).toEqual({ safe: true })
		})

		it('should handle pattern at exactly max length', () => {
			const exactLengthPattern = 'a'.repeat(500)
			expect(isSafePattern(exactLengthPattern).safe).toBe(true)
		})

		it('should handle common form validation patterns', () => {
			// Phone pattern - simple bounded quantifiers
			expect(isSafePattern('^\\d{3}-\\d{3}-\\d{4}$').safe).toBe(true)

			// SSN pattern
			expect(isSafePattern('^\\d{3}-\\d{2}-\\d{4}$').safe).toBe(true)

			// Date pattern
			expect(isSafePattern('^\\d{4}-\\d{2}-\\d{2}$').safe).toBe(true)

			// Simple alphanumeric
			expect(isSafePattern('^[a-zA-Z0-9]+$').safe).toBe(true)

			// Fixed length codes
			expect(isSafePattern('^[A-Z]{2}\\d{6}$').safe).toBe(true)
		})

		it('should reject patterns with potential backtracking', () => {
			// Nested quantifiers are flagged
			expect(isSafePattern('(a+)+').safe).toBe(false)
			expect(isSafePattern('([a-z]+)*').safe).toBe(false)
		})
	})
})
