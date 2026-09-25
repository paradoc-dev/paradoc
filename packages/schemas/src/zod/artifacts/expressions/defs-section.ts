import { z } from 'zod';
import { IDENTIFIER_PATTERN } from '../../primitives/name';
import { ExpressionSchema } from './expression';

/**
 * Defs Section Schema
 *
 * A record of named computed values with type information and metadata.
 * Keys are definition identifiers, values are typed expressions.
 */
export const DefsSectionSchema = z.record(
	z.string()
		.min(1)
		.max(100)
		.regex(IDENTIFIER_PATTERN)
		.describe('Definition identifier (camelCase, starts with lowercase letter)'),
	ExpressionSchema,
).meta({
	title: 'DefsSection',
	description: 'Named computed values with type information that can be referenced in conditional expressions',
});
