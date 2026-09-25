import { z } from 'zod';
import { IDENTIFIER_PATTERN } from '../../primitives/name';
import type { FieldsetField, FormField, ListField } from '@paradoc/types';
import { BaseFieldSchema } from './base-field';
import { CoordinateSchema } from '../../primitives/coordinate';
import { BboxSchema } from '../../primitives/bbox';
import { CurrencyCodeSchema, MoneySchema } from '../../primitives/money';
import { AddressSchema } from '../../primitives/address';
import { PhoneSchema } from '../../primitives/phone';
import { DurationSchema } from '../../primitives/duration';
import { PersonSchema } from '../../primitives/person';
import { OrganizationSchema } from '../../primitives/organization';
import { IdentificationSchema } from '../../primitives/identification';
import { FieldPatternSchema } from './pattern';
import {
	compareClockTimeBounds,
	compareTemporalBounds,
	getOrderedBoundsIssue,
} from './ordered-bounds';

const EnumOptionValueSchema = z.union([z.string(), z.number()]);

const EnumOptionSchema = z.object({
	value: EnumOptionValueSchema.describe('Internal option value'),
	label: z.string()
		.min(1)
		.max(200)
		.describe('Human-readable label for the option in the artifact source language')
		.optional(),
}).strict();

// A length, count, or number of decimal places: a non-negative integer.
const CountSchema = z.number().int().min(0);

const EnumOptionsSchema = z.array(EnumOptionSchema)
	.min(1)
	.superRefine((options, ctx) => {
		const seen = new Set<string | number>();
		options.forEach((option, index) => {
			if (seen.has(option.value)) {
				ctx.addIssue({
					code: 'custom',
					path: [index, 'value'],
					message: `Duplicate option value ${JSON.stringify(option.value)}`,
				});
			}
			seen.add(option.value);
		});
	});

const TextFieldSchema = BaseFieldSchema.extend({
	type: z.literal('text'),
	minLength: CountSchema.describe('Minimum length').optional(),
	maxLength: CountSchema.describe('Maximum length').optional(),
	pattern: FieldPatternSchema.optional(),
	default: z.string().describe('Default value').optional(),
}).superRefine((field, ctx) => {
	const issue = getOrderedBoundsIssue(
		field.minLength,
		field.maxLength,
		'minLength',
		'maxLength',
		(min, max) => min <= max,
	)
	if (issue) ctx.addIssue({ code: 'custom', ...issue })
});

const BooleanFieldSchema = BaseFieldSchema.extend({
	type: z.literal('boolean'),
	default: z.boolean().describe('Default value').optional(),
});

const NumberFieldSchema = BaseFieldSchema.extend({
	type: z.literal('number'),
	min: z.number().describe('Minimum value').optional(),
	max: z.number().describe('Maximum value').optional(),
	step: z.number()
		.positive()
		.describe('Allowed increment: a value must be a multiple of step (e.g., 0.01 for cents)')
		.optional(),
	default: z.number().describe('Default value').optional(),
}).superRefine((field, ctx) => {
	const issue = getOrderedBoundsIssue(field.min, field.max, 'min', 'max', (min, max) => min <= max)
	if (issue) ctx.addIssue({ code: 'custom', ...issue })
});

const CoordinateFieldSchema = BaseFieldSchema.extend({
	type: z.literal('coordinate'),
	default: CoordinateSchema.optional(),
});

const BboxFieldSchema = BaseFieldSchema.extend({
	type: z.literal('bbox'),
	default: BboxSchema.optional(),
});

const MoneyFieldSchema = BaseFieldSchema.extend({
	type: z.literal('money'),
	min: z.number().describe('Minimum amount').optional(),
	max: z.number().describe('Maximum amount').optional(),
	currency: CurrencyCodeSchema
		.describe('ISO 4217 alpha-3 currency code a value must use (e.g., USD). Omit to accept any currency')
		.optional(),
	default: MoneySchema.optional(),
}).superRefine((field, ctx) => {
	const issue = getOrderedBoundsIssue(field.min, field.max, 'min', 'max', (min, max) => min <= max)
	if (issue) ctx.addIssue({ code: 'custom', ...issue })
});

const AddressFieldSchema = BaseFieldSchema.extend({
	type: z.literal('address'),
	default: AddressSchema.optional(),
});

const PhoneFieldSchema = BaseFieldSchema.extend({
	type: z.literal('phone'),
	default: PhoneSchema.optional(),
});

const DurationFieldSchema = BaseFieldSchema.extend({
	type: z.literal('duration'),
	default: DurationSchema.optional(),
});

const EmailFieldSchema = BaseFieldSchema.extend({
	type: z.literal('email'),
	minLength: CountSchema.describe('Minimum length').optional(),
	maxLength: CountSchema.describe('Maximum length').optional(),
	default: z.string().describe('Default value').optional(),
}).superRefine((field, ctx) => {
	const issue = getOrderedBoundsIssue(
		field.minLength,
		field.maxLength,
		'minLength',
		'maxLength',
		(min, max) => min <= max,
	)
	if (issue) ctx.addIssue({ code: 'custom', ...issue })
});

const UuidFieldSchema = BaseFieldSchema.extend({
	type: z.literal('uuid'),
	minLength: CountSchema.describe('Minimum length').optional(),
	maxLength: CountSchema.describe('Maximum length').optional(),
	pattern: FieldPatternSchema.optional(),
	default: z.string().describe('Default value').optional(),
}).superRefine((field, ctx) => {
	const issue = getOrderedBoundsIssue(
		field.minLength,
		field.maxLength,
		'minLength',
		'maxLength',
		(min, max) => min <= max,
	)
	if (issue) ctx.addIssue({ code: 'custom', ...issue })
});

const UriFieldSchema = BaseFieldSchema.extend({
	type: z.literal('uri'),
	minLength: CountSchema.describe('Minimum length').optional(),
	maxLength: CountSchema.describe('Maximum length').optional(),
	pattern: FieldPatternSchema.optional(),
	default: z.string().describe('Default value').optional(),
}).superRefine((field, ctx) => {
	const issue = getOrderedBoundsIssue(
		field.minLength,
		field.maxLength,
		'minLength',
		'maxLength',
		(min, max) => min <= max,
	)
	if (issue) ctx.addIssue({ code: 'custom', ...issue })
});

const EnumFieldSchema = BaseFieldSchema.extend({
	type: z.literal('enum'),
	enum: EnumOptionsSchema.describe('Array of allowed options for the enum field'),
	default: EnumOptionValueSchema
		.describe('Default value')
		.optional(),
}).superRefine((field, ctx) => {
	if (
		field.default !== undefined &&
		!field.enum.some((option) => option.value === field.default)
	) {
		ctx.addIssue({
			code: 'custom',
			path: ['default'],
			message: 'Default value must match one of the enum option values',
		});
	}
});

const DateFieldSchema = BaseFieldSchema.extend({
	type: z.literal('date'),
	min: z.iso.date()
		.describe('Minimum date (ISO 8601: YYYY-MM-DD)')
		.optional(),
	max: z.iso.date()
		.describe('Maximum date (ISO 8601: YYYY-MM-DD)')
		.optional(),
	default: z.iso.date().describe('Default value').optional(),
}).superRefine((field, ctx) => {
	const issue = getOrderedBoundsIssue(field.min, field.max, 'min', 'max', compareTemporalBounds)
	if (issue) ctx.addIssue({ code: 'custom', ...issue })
});

const DatetimeValueSchema = z.iso.datetime({ offset: true }).regex(
	/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/,
)

const DatetimeFieldSchema = BaseFieldSchema.extend({
	type: z.literal('datetime'),
	min: DatetimeValueSchema
		.describe('Minimum datetime (ISO 8601 with Z or ±HH:MM timezone)')
		.optional(),
	max: DatetimeValueSchema
		.describe('Maximum datetime (ISO 8601 with Z or ±HH:MM timezone)')
		.optional(),
	default: DatetimeValueSchema.describe('Default value').optional(),
}).superRefine((field, ctx) => {
	const issue = getOrderedBoundsIssue(field.min, field.max, 'min', 'max', compareTemporalBounds)
	if (issue) ctx.addIssue({ code: 'custom', ...issue })
});

const TimeValueSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?$/)

const TimeFieldSchema = BaseFieldSchema.extend({
	type: z.literal('time'),
	min: TimeValueSchema.describe('Minimum time (HH:MM:SS[.fff])').optional(),
	max: TimeValueSchema.describe('Maximum time (HH:MM:SS[.fff])').optional(),
	default: TimeValueSchema.describe('Default value').optional(),
}).superRefine((field, ctx) => {
	const issue = getOrderedBoundsIssue(field.min, field.max, 'min', 'max', compareClockTimeBounds)
	if (issue) ctx.addIssue({ code: 'custom', ...issue })
});

const PersonFieldSchema = BaseFieldSchema.extend({
	type: z.literal('person'),
	default: PersonSchema.optional(),
});

const OrganizationFieldSchema = BaseFieldSchema.extend({
	type: z.literal('organization'),
	default: OrganizationSchema.optional(),
});

const IdentificationFieldSchema = BaseFieldSchema.extend({
	type: z.literal('identification'),
	allowedTypes: z.array(z.string())
		.describe('Allowed ID types (e.g., passport, drivers_license)')
		.optional(),
	default: IdentificationSchema.optional(),
});

const MultiselectFieldSchema = BaseFieldSchema.extend({
	type: z.literal('multiselect'),
	enum: EnumOptionsSchema.describe('Available options'),
	min: CountSchema.describe('Minimum selections required').optional(),
	max: CountSchema.describe('Maximum selections allowed').optional(),
	default: z.array(EnumOptionValueSchema)
		.describe('Default selected values')
		.optional(),
}).superRefine((field, ctx) => {
	const issue = getOrderedBoundsIssue(field.min, field.max, 'min', 'max', (min, max) => min <= max)
	if (issue) ctx.addIssue({ code: 'custom', ...issue })
	field.default?.forEach((value, index) => {
		if (!field.enum.some((option) => option.value === value)) {
			ctx.addIssue({
				code: 'custom',
				path: ['default', index],
				message: 'Default value must match one of the multiselect option values',
			});
		}
	});
});

const PercentageFieldSchema = BaseFieldSchema.extend({
	type: z.literal('percentage'),
	min: z.number().describe('Minimum value (default: 0)').optional(),
	max: z.number().describe('Maximum value (default: 100)').optional(),
	precision: CountSchema.describe('Decimal places (default: 2)').optional(),
	default: z.number().describe('Default value').optional(),
}).superRefine((field, ctx) => {
	const issue = getOrderedBoundsIssue(field.min, field.max, 'min', 'max', (min, max) => min <= max)
	if (issue) ctx.addIssue({ code: 'custom', ...issue })
});

const RatingFieldSchema = BaseFieldSchema.extend({
	type: z.literal('rating'),
	min: z.number().describe('Minimum value (default: 1)').optional(),
	max: z.number().describe('Maximum value (default: 5)').optional(),
	step: z.number().positive().describe('Increment step (e.g., 0.5 for half stars, default: 1)').optional(),
	default: z.number().describe('Default value').optional(),
}).superRefine((field, ctx) => {
	const issue = getOrderedBoundsIssue(field.min, field.max, 'min', 'max', (min, max) => min <= max)
	if (issue) ctx.addIssue({ code: 'custom', ...issue })
});

// FieldsetFieldSchema - a field that contains nested fields (recursive)
export const FieldsetFieldObjectSchema = BaseFieldSchema.extend({
	type: z.literal('fieldset'),
	fields: z.lazy(() => z.record(
		z.string().min(1).max(100).regex(IDENTIFIER_PATTERN).describe('Nested field identifier (camelCase, starts with lowercase letter)'),
		FormFieldSchema,
	)),
}).meta({
	id: 'FieldsetField',
	title: 'FieldsetField',
	description: 'Field that groups nested fields under one key',
});

export const FieldsetFieldSchema: z.ZodType<FieldsetField> = FieldsetFieldObjectSchema;

export const ListFieldObjectSchema = BaseFieldSchema.extend({
	type: z.literal('list'),
	item: z.lazy(() => FormFieldSchema),
	minItems: z.number().int().min(0).describe('Minimum number of items').optional(),
	maxItems: z.number().int().min(0).describe('Maximum number of items').optional(),
}).superRefine((field, ctx) => {
	const issue = getOrderedBoundsIssue(
		field.minItems,
		field.maxItems,
		'minItems',
		'maxItems',
		(min, max) => min <= max,
	)
	if (issue) ctx.addIssue({ code: 'custom', ...issue })
}).meta({
	id: 'ListField',
	title: 'ListField',
	description: 'Field that holds a list of items, each shaped by the item field',
});

export const ListFieldSchema: z.ZodType<ListField> = ListFieldObjectSchema;

// The schemas that make up the field union, in one place, so the union and the
// list of valid `type` values below can never drift apart.
export const FIELD_SCHEMAS = [
	TextFieldSchema,
	BooleanFieldSchema,
	NumberFieldSchema,
	CoordinateFieldSchema,
	BboxFieldSchema,
	MoneyFieldSchema,
	AddressFieldSchema,
	PhoneFieldSchema,
	DurationFieldSchema,
	EmailFieldSchema,
	UuidFieldSchema,
	UriFieldSchema,
	EnumFieldSchema,
	DateFieldSchema,
	DatetimeFieldSchema,
	TimeFieldSchema,
	PersonFieldSchema,
	OrganizationFieldSchema,
	IdentificationFieldSchema,
	MultiselectFieldSchema,
	PercentageFieldSchema,
	RatingFieldSchema,
	FieldsetFieldObjectSchema,
	ListFieldObjectSchema,
] as const;

// Complete field union, discriminated on `type`, so an unknown key is reported
// against the one field shape its type names.
export const FormFieldSchema: z.ZodType<FormField> = z.lazy(() => z.discriminatedUnion('type', FIELD_SCHEMAS)).meta({
	title: 'FormField',
	description: 'Single input/data element, nested fieldset, or recursive list',
});

/** Every field `type` the schema accepts, derived from the field union itself. */
export const FORM_FIELD_TYPES = FIELD_SCHEMAS.map((schema) => schema.shape.type.value);

export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];
