import { z } from 'zod';
import safeRegex from 'safe-regex';

/** The longest regular expression a field `pattern` may hold. */
export const MAX_PATTERN_LENGTH = 500;

/** Why a regular expression pattern is refused. */
export type PatternProblem = 'too_long' | 'invalid' | 'redos';

/**
 * Find why a regular expression pattern is unsafe to compile, if it is.
 *
 * The pattern is compiled before the ReDoS check, so a syntax error is
 * reported as `invalid` and not as a ReDoS risk.
 */
export function findPatternProblem(pattern: string): PatternProblem | undefined {
	if (pattern.length > MAX_PATTERN_LENGTH) return 'too_long';
	try {
		new RegExp(pattern);
	} catch {
		return 'invalid';
	}
	if (!safeRegex(pattern)) return 'redos';
	return undefined;
}

const PATTERN_PROBLEM_PHRASES: Record<PatternProblem, string> = {
	too_long: `exceeds the maximum length of ${MAX_PATTERN_LENGTH} characters`,
	invalid: 'has invalid regular expression syntax',
	redos: 'is potentially unsafe (ReDoS vulnerability detected)',
};

/** The message that states a pattern problem, such as "Pattern has invalid regular expression syntax". */
export function describePatternProblem(problem: PatternProblem, subject = 'Pattern'): string {
	return `${subject} ${PATTERN_PROBLEM_PHRASES[problem]}`;
}

/** A field `pattern`: a regular expression that compiles and is safe from ReDoS. */
export const FieldPatternSchema = z.string()
	.min(1)
	.max(MAX_PATTERN_LENGTH)
	.superRefine((pattern, ctx) => {
		const problem = findPatternProblem(pattern);
		if (problem) ctx.addIssue({ code: 'custom', message: describePatternProblem(problem) });
	})
	.describe('Regular expression pattern for validation');
