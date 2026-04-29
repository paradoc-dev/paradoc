import { z } from 'zod';
import { ArtifactSchema } from '../shared/base';
import { LayerSchema } from '../shared/layer';
import { DefsSectionSchema } from '../expressions/defs-section';
import { RulesSectionSchema } from '../rules/rules-section';
import { FormFieldSchema } from './field';
import { FormAnnexSchema } from './annex';
import { FormPartySchema } from './party';

// Re-export all form-related schemas
export { FormFieldSchema, FieldsetFieldSchema } from './field';
export { FormFieldsetSchema } from './fieldset';
export { FormAnnexSchema } from './annex';
export { FormPartySchema } from './party';

export const FormSchema = ArtifactSchema.extend({
	kind: z.literal('form'),
	defs: DefsSectionSchema.optional(),
	rules: RulesSectionSchema
		.describe('Form-level validation rules for cross-field constraints. Rules use expr-eval-fork expressions with direct access to field values and defs section values.')
		.optional(),
	fields: z.record(
		z.string()
			.min(1)
			.max(100)
			.regex(/^[a-z][a-zA-Z0-9_]*$/)
			.describe('Field identifier (camelCase, starts with lowercase letter)'),
		FormFieldSchema,
	).describe('Form field definitions keyed by field identifier. Fields define the input structure and validation rules for the form')
		.optional(),
	layers: z.record(
		z.string()
			.min(1)
			.max(100)
			.regex(/^[a-z][a-zA-Z0-9_]*$/)
			.describe('Layer identifier (camelCase, starts with lowercase letter)'),
		LayerSchema,
	).describe('Named layers for rendering this form into different formats. Keys are user-defined identifiers (e.g., markdown, pdf, html)')
		.optional(),
	defaultLayer: z.string()
		.min(1)
		.max(100)
		.describe('Key of the default layer to use when none specified at render time')
		.optional(),
	allowAdditionalAnnexes: z.boolean()
		.default(false)
		.describe('Whether additional ad-hoc annexes can be attached beyond those defined in the annexes record')
		.optional(),
	annexes: z.record(
		z.string()
			.min(1)
			.max(100)
			.regex(/^[a-z][a-zA-Z0-9_]*$/)
			.describe('Annex identifier (camelCase, starts with lowercase letter)'),
		FormAnnexSchema,
	).describe('Predefined annex slots keyed by identifier. Each slot can be marked as required (must be filled at runtime) or optional')
		.optional(),
	parties: z.record(
		z.string()
			.min(1)
			.max(50)
			.regex(/^[a-z][a-zA-Z0-9_]*$/)
			.describe('Party role identifier (e.g., buyer, seller, landlord, buyerRepresentative)'),
		FormPartySchema,
	).describe('Party role definitions keyed by role identifier. Each role specifies constraints on who can fill it (person/organization) and signature requirements.')
		.optional(),
}).meta({
	title: 'Form',
	description: 'A form artifact that defines a data contract with field definitions, optional layers for rendering, and optional annexes. Forms are the primary artifact type for structured data collection and document generation.',
}).strict();
