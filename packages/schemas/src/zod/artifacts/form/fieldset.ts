import { z } from 'zod';
import { FormFieldSchema } from './field';

export const FormFieldsetSchema = z.object({
	title: z.string()
		.min(1)
		.max(200)
		.describe('Title or heading for the fieldset')
		.optional(),
	description: z.string()
		.min(1)
		.max(1000)
		.describe('Description or summary of the fieldset')
		.optional(),
	fields: z.record(
		z.string().min(1).max(100).regex(/^[a-z][a-zA-Z0-9_]*$/).describe('Field identifier (camelCase, starts with lowercase letter)'),
		FormFieldSchema,
	),
	required: z.boolean()
		.describe('Whether fieldset is required')
		.optional(),
	order: z.number()
		.min(0)
		.describe('Display order (lower numbers appear first)')
		.optional(),
}).meta({
	title: 'FormFieldset',
	description: 'Grouped collection of fields that can be nested. Fields are keyed by their identifier',
}).strict();
