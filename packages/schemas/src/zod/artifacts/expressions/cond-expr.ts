import { z } from 'zod';

/**
 * Conditional Expression Schema
 *
 * A CondExpr can be:
 * - A boolean literal (true/false) for static conditions
 * - A string expression that evaluates to boolean at runtime
 *
 * String expressions can be:
 * - A reference to a defs key (e.g., 'isBusinessAccount')
 * - An inline expression (e.g., 'fields.age.value >= 18')
 */
export const CondExprSchema = z.union([
	z.boolean().describe('Literal boolean value'),
	z.string()
		.min(1)
		.max(2000)
		.describe('Expression string - either inline expression or reference to a defs key'),
]).meta({
	title: 'CondExpr',
	description: 'Conditional expression: boolean literal or expression string',
});
