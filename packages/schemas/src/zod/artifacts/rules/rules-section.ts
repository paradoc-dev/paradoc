import { z } from 'zod';
import { ValidationRuleSchema } from './validation-rule';

/**
 * Rules Section Schema
 *
 * A record of named validation rules for form-level validation.
 * Keys are rule identifiers, values are validation rules.
 */
export const RulesSectionSchema = z.record(
	z.string()
		.min(1)
		.max(100)
		.regex(/^[a-z][a-zA-Z0-9_]*$/)
		.describe('Validation rule identifier (camelCase, starts with lowercase letter)'),
	ValidationRuleSchema,
).meta({
	title: 'RulesSection',
	description: 'Form-level validation rules keyed by rule identifier. Rules use expr-eval-fork expressions to validate cross-field constraints.',
});
