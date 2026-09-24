/**
 * Safe Pattern Validation
 *
 * Utilities for validating regex patterns to prevent ReDoS attacks.
 * ReDoS (Regular Expression Denial of Service) occurs when malicious
 * patterns cause catastrophic backtracking.
 */

import {
	ISO_8601_DURATION_PATTERN,
	describePatternProblem,
	findPatternProblem,
	type PatternProblem,
} from '@paradoc/schemas'
import { TIME_PATTERN } from '@/primitives/time'

/**
 * Schema-defined patterns known to be safe despite safe-regex false positives.
 * These come from Paradoc's own schema definitions, not user input.
 * Each is manually verified: quantified character classes (\d) don't overlap
 * with their literal separators, so no catastrophic backtracking is possible.
 */
const KNOWN_SAFE_PATTERNS = new Set([
	// ISO 8601 duration: \d+ groups separated by non-overlapping literals (P,Y,M,W,D,T,H,S).
	// The lookaheads enforce that P and T are followed by a component.
	ISO_8601_DURATION_PATTERN,
	// Time-of-day (@/primitives/time.ts): fixed-width HH:MM:SS digit classes followed
	// by one unambiguous trailing `\d+` for the fraction, anchored at the end of the
	// string. No overlap between the quantified group and anything after it.
	TIME_PATTERN,
])

/**
 * Error thrown when a pattern is unsafe or invalid
 */
export class UnsafePatternError extends Error {
	constructor(
		message: string,
		public pattern: string,
		public reason: PatternProblem
	) {
		super(message)
		this.name = 'UnsafePatternError'
	}
}

/**
 * Find why a pattern is refused. The rule is `@paradoc/schemas`' field pattern
 * rule, so a pattern the schema accepts compiles here. Paradoc's own patterns
 * in `KNOWN_SAFE_PATTERNS` skip the ReDoS check.
 */
function findProblem(pattern: string): PatternProblem | undefined {
	const problem = findPatternProblem(pattern)
	return problem === 'redos' && KNOWN_SAFE_PATTERNS.has(pattern) ? undefined : problem
}

/**
 * Validate that a regex pattern compiles and is safe from ReDoS attacks
 *
 * @param pattern - The regex pattern string to validate
 * @param fieldName - Optional field name for error messages
 * @throws UnsafePatternError if the pattern is unsafe or invalid
 */
export function assertSafePattern(pattern: string, fieldName?: string): void {
	const problem = findProblem(pattern)
	if (!problem) return
	const fieldContext = fieldName ? ` in field "${fieldName}"` : ''
	throw new UnsafePatternError(describePatternProblem(problem, `Regex pattern${fieldContext}`), pattern, problem)
}

/**
 * Check if a pattern is safe without throwing
 *
 * @param pattern - The regex pattern string to check
 * @returns Object with safe flag and optional error details
 */
export function isSafePattern(pattern: string): {
	safe: boolean
	reason?: PatternProblem
	message?: string
} {
	const problem = findProblem(pattern)
	return problem ? { safe: false, reason: problem, message: describePatternProblem(problem) } : { safe: true }
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
