import { z } from 'zod';

/**
 * Validation Rule Schema
 *
 * Defines a form-level validation rule that uses expr-eval-fork expressions.
 * Rules evaluate to boolean - true means valid, false means invalid.
 */

/**
 * Severity levels for validation rules.
 * - 'error': Blocks form submission (default)
 * - 'warning': Allows submission but shows warning
 */
export const RuleSeveritySchema = z.enum(['error', 'warning'])
	.describe('Severity level: error blocks submission, warning allows but warns');

/**
 * Validation Rule Schema
 *
 * A validation rule consists of a boolean expression and an error message.
 * The expression has access to field values directly (e.g., "ssn or ein")
 * and defs section values.
 */
export const ValidationRuleSchema = z.object({
	expr: z.string()
		.min(1)
		.max(2000)
		.describe('Boolean expression that must evaluate to true for the form to be valid. Has access to field values directly (e.g., "ssn or ein") and defs section values.'),
	message: z.string()
		.min(1)
		.max(500)
		.describe('Error message displayed when the rule fails (expression evaluates to false)'),
	severity: RuleSeveritySchema
		.default('error')
		.describe('Severity level: error (default) blocks submission, warning allows but warns')
		.optional(),
}).meta({
	title: 'ValidationRule',
	description: 'A form-level validation rule with a boolean expression and error message',
}).strict();
