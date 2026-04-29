/**
 * Safe Pattern Validation
 *
 * Utilities for validating regex patterns to prevent ReDoS attacks.
 * ReDoS (Regular Expression Denial of Service) occurs when malicious
 * patterns cause catastrophic backtracking.
 */

import safeRegex from 'safe-regex'

/**
 * Maximum allowed pattern length (defense in depth)
 */
const MAX_PATTERN_LENGTH = 500

/**
 * Schema-defined patterns known to be safe despite safe-regex false positives.
 * These come from Paradoc's own schema definitions, not user input.
 * Each is manually verified: quantified character classes (\d) don't overlap
 * with their literal separators, so no catastrophic backtracking is possible.
 */
const KNOWN_SAFE_PATTERNS = new Set([
	// ISO 8601 duration: \d+ groups separated by non-overlapping literals (P,Y,M,D,T,H,S)
	String.raw`^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?$`,
])

/**
 * Error thrown when a pattern is unsafe or invalid
 */
export class UnsafePatternError extends Error {
	constructor(
		message: string,
		public pattern: string,
		public reason: 'redos' | 'too_long' | 'invalid'
	) {
		super(message)
		this.name = 'UnsafePatternError'
	}
}

/**
 * Validate that a regex pattern is safe from ReDoS attacks
 *
 * @param pattern - The regex pattern string to validate
 * @param fieldName - Optional field name for error messages
 * @throws UnsafePatternError if the pattern is unsafe
 */
export function assertSafePattern(pattern: string, fieldName?: string): void {
	const fieldContext = fieldName ? ` in field "${fieldName}"` : ''

	// Check pattern length first (defense in depth)
	if (pattern.length > MAX_PATTERN_LENGTH) {
		throw new UnsafePatternError(
			`Regex pattern${fieldContext} exceeds maximum length of ${MAX_PATTERN_LENGTH} characters`,
			pattern,
			'too_long'
		)
	}

	// Check for ReDoS vulnerability using safe-regex (skip known-safe schema patterns)
	if (!KNOWN_SAFE_PATTERNS.has(pattern) && !safeRegex(pattern)) {
		throw new UnsafePatternError(
			`Regex pattern${fieldContext} is potentially unsafe (ReDoS vulnerability detected)`,
			pattern,
			'redos'
		)
	}

	// Validate that the pattern compiles (catch syntax errors)
	try {
		new RegExp(pattern)
	} catch {
		throw new UnsafePatternError(
			`Invalid regex pattern${fieldContext}: syntax error`,
			pattern,
			'invalid'
		)
	}
}

/**
 * Check if a pattern is safe without throwing
 *
 * @param pattern - The regex pattern string to check
 * @returns Object with safe flag and optional error details
 */
export function isSafePattern(pattern: string): {
	safe: boolean
	reason?: 'redos' | 'too_long' | 'invalid'
	message?: string
} {
	if (pattern.length > MAX_PATTERN_LENGTH) {
		return {
			safe: false,
			reason: 'too_long',
			message: `Pattern exceeds maximum length of ${MAX_PATTERN_LENGTH} characters`,
		}
	}

	if (!KNOWN_SAFE_PATTERNS.has(pattern) && !safeRegex(pattern)) {
		return {
			safe: false,
			reason: 'redos',
			message: 'Pattern is potentially unsafe (ReDoS vulnerability)',
		}
	}

	try {
		new RegExp(pattern)
	} catch {
		return {
			safe: false,
			reason: 'invalid',
			message: 'Pattern has invalid regex syntax',
		}
	}

	return { safe: true }
}

/**
 * Create a RegExp from a pattern after validating it is safe
 *
 * @param pattern - The regex pattern string
 * @param flags - Optional regex flags
 * @param fieldName - Optional field name for error messages
 * @returns A safe RegExp instance
 * @throws UnsafePatternError if the pattern is unsafe
 */
export function createSafeRegex(pattern: string, flags?: string, fieldName?: string): RegExp {
	assertSafePattern(pattern, fieldName)
	return new RegExp(pattern, flags)
}
