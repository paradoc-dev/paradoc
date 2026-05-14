import { z } from 'zod';
import { CondExprSchema } from '../expressions/cond-expr';
import { CoordinateSchema } from '../../primitives/coordinate';
import { BboxSchema } from '../../primitives/bbox';
import { MoneySchema } from '../../primitives/money';
import { AddressSchema } from '../../primitives/address';
import { PhoneSchema } from '../../primitives/phone';
import { DurationSchema } from '../../primitives/duration';
import { PersonSchema } from '../../primitives/person';
import { OrganizationSchema } from '../../primitives/organization';
import { IdentificationSchema } from '../../primitives/identification';

const BaseFieldSchema = z.object({
	label: z.string()
		.min(1)
		.max(200)
		.describe('Display label for the field')
		.optional(),
	description: z.string()
		.min(1)
		.max(1000)
		.describe('Description or help text for the field')
		.optional(),
	required: CondExprSchema.optional(),
	visible: CondExprSchema.optional(),
});

const TextFieldSchema = BaseFieldSchema.extend({
	type: z.literal('text'),
	minLength: z.number().describe('Minimum length').optional(),
	maxLength: z.number().describe('Maximum length').optional(),
	pattern: z.string()
		.min(1)
		.max(500)
		.describe('Regular expression pattern for validation')
		.optional(),
	default: z.string().describe('Default value').optional(),
});

const BooleanFieldSchema = BaseFieldSchema.extend({
	type: z.literal('boolean'),
	default: z.boolean().describe('Default value').optional(),
});

const NumberFieldSchema = BaseFieldSchema.extend({
	type: z.literal('number'),
	min: z.number().describe('Minimum value').optional(),
	max: z.number().describe('Maximum value').optional(),
	default: z.number().describe('Default value').optional(),
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
	default: MoneySchema.optional(),
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
	minLength: z.number().describe('Minimum length').optional(),
	maxLength: z.number().describe('Maximum length').optional(),
	default: z.string().describe('Default value').optional(),
});

const UuidFieldSchema = BaseFieldSchema.extend({
	type: z.literal('uuid'),
	minLength: z.number().describe('Minimum length').optional(),
	maxLength: z.number().describe('Maximum length').optional(),
	pattern: z.string()
		.min(1)
		.max(500)
		.describe('Regular expression pattern for validation')
		.optional(),
	default: z.string().describe('Default value').optional(),
});

const UriFieldSchema = BaseFieldSchema.extend({
	type: z.literal('uri'),
	minLength: z.number().describe('Minimum length').optional(),
	maxLength: z.number().describe('Maximum length').optional(),
	pattern: z.string()
		.min(1)
		.max(500)
		.describe('Regular expression pattern for validation')
		.optional(),
	default: z.string().describe('Default value').optional(),
});

const EnumFieldSchema = BaseFieldSchema.extend({
	type: z.literal('enum'),
	enum: z.array(z.union([z.string(), z.number()]))
		.min(1)
		.describe('Array of allowed values for the enum field'),
	default: z.union([z.string(), z.number()])
		.describe('Default value')
		.optional(),
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
});

const DatetimeFieldSchema = BaseFieldSchema.extend({
	type: z.literal('datetime'),
	min: z.iso.datetime()
		.describe('Minimum datetime (ISO 8601)')
		.optional(),
	max: z.iso.datetime()
		.describe('Maximum datetime (ISO 8601)')
		.optional(),
	default: z.iso.datetime().describe('Default value').optional(),
});

const TimeFieldSchema = BaseFieldSchema.extend({
	type: z.literal('time'),
	min: z.string().describe('Minimum time (HH:MM:SS)').optional(),
	max: z.string().describe('Maximum time (HH:MM:SS)').optional(),
	default: z.string().describe('Default value').optional(),
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
	enum: z.array(z.union([z.string(), z.number()]))
		.min(1)
		.describe('Available options'),
	min: z.number().describe('Minimum selections required').optional(),
	max: z.number().describe('Maximum selections allowed').optional(),
	default: z.array(z.union([z.string(), z.number()]))
		.describe('Default selected values')
		.optional(),
});

const PercentageFieldSchema = BaseFieldSchema.extend({
	type: z.literal('percentage'),
	min: z.number().describe('Minimum value (default: 0)').optional(),
	max: z.number().describe('Maximum value (default: 100)').optional(),
	precision: z.number().describe('Decimal places (default: 2)').optional(),
	default: z.number().describe('Default value').optional(),
});

const RatingFieldSchema = BaseFieldSchema.extend({
	type: z.literal('rating'),
	min: z.number().describe('Minimum value (default: 1)').optional(),
	max: z.number().describe('Maximum value (default: 5)').optional(),
	step: z.number().describe('Increment step (e.g., 0.5 for half stars, default: 1)').optional(),
	default: z.number().describe('Default value').optional(),
});

// Define base field types (non-recursive)
const BaseFieldSchemaTypes = z.discriminatedUnion('type', [
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
]);

// Type for base field
export type BaseField = z.infer<typeof BaseFieldSchemaTypes>;

// FieldsetFieldSchema - a field that contains nested fields (recursive)
export interface FieldsetField {
	label?: string;
	description?: string;
	required?: boolean | string;
	visible?: boolean | string;
	type: 'fieldset';
	fields: Record<string, BaseField | FieldsetField>;
}

export const FieldsetFieldSchema: z.ZodType<FieldsetField> = BaseFieldSchema.extend({
	type: z.literal('fieldset'),
	fields: z.lazy(() => z.record(
		z.string().min(1).max(100).regex(/^[a-z][a-zA-Z0-9_]*$/).describe('Nested field identifier (camelCase, starts with lowercase letter)'),
		z.union([BaseFieldSchemaTypes, FieldsetFieldSchema]),
	)),
}).meta({ id: 'FieldsetField' });

// Complete Field union including FieldsetFieldSchema
export const FormFieldSchema = z.union([
	BaseFieldSchemaTypes,
	FieldsetFieldSchema,
]).meta({
	title: 'FormField',
	description: 'Single input/data element. Fields are keyed by their identifier and can be of various types (text, number, boolean, address, phone, etc.) or nested fieldsets',
});
