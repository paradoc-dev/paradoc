import { z } from 'zod';

/**
 * Expression Schema
 *
 * Defines typed computed values with metadata for the defs section.
 * Supports both scalar types (where value is a single expression string)
 * and object types (where value contains expression strings for each property).
 */

// ============================================================================
// Base Schema with Common Metadata
// ============================================================================

const BaseExpressionSchema = z.object({
	label: z.string()
		.min(1)
		.max(200)
		.describe('Display label for the computed value')
		.optional(),
	description: z.string()
		.min(1)
		.max(1000)
		.describe('Description or documentation of the computed value')
		.optional(),
}).strict();

// Expression string constraints
const ExpressionString = z.string()
	.min(1)
	.max(2000)
	.describe('Expression string to evaluate');

const OptionalExpressionString = ExpressionString.optional();

// ============================================================================
// Scalar Types (value is a single expression string)
// ============================================================================

const BooleanExpressionSchema = BaseExpressionSchema.extend({
	type: z.literal('boolean'),
	value: z.string()
		.min(1)
		.max(2000)
		.describe('Expression that evaluates to a boolean'),
});

const StringExpressionSchema = BaseExpressionSchema.extend({
	type: z.literal('string'),
	value: z.string()
		.min(1)
		.max(2000)
		.describe('Expression that evaluates to a string'),
});

const NumberExpressionSchema = BaseExpressionSchema.extend({
	type: z.literal('number'),
	value: z.string()
		.min(1)
		.max(2000)
		.describe('Expression that evaluates to a number'),
});

const IntegerExpressionSchema = BaseExpressionSchema.extend({
	type: z.literal('integer'),
	value: z.string()
		.min(1)
		.max(2000)
		.describe('Expression that evaluates to an integer'),
});

const PercentageExpressionSchema = BaseExpressionSchema.extend({
	type: z.literal('percentage'),
	value: z.string()
		.min(1)
		.max(2000)
		.describe('Expression that evaluates to a percentage (0-100)'),
});

const RatingExpressionSchema = BaseExpressionSchema.extend({
	type: z.literal('rating'),
	value: z.string()
		.min(1)
		.max(2000)
		.describe('Expression that evaluates to a rating value'),
});

const DateExpressionSchema = BaseExpressionSchema.extend({
	type: z.literal('date'),
	value: z.string()
		.min(1)
		.max(2000)
		.describe('Expression that evaluates to an ISO 8601 date (YYYY-MM-DD)'),
});

const TimeExpressionSchema = BaseExpressionSchema.extend({
	type: z.literal('time'),
	value: z.string()
		.min(1)
		.max(2000)
		.describe('Expression that evaluates to a time (HH:MM:SS)'),
});

const DatetimeExpressionSchema = BaseExpressionSchema.extend({
	type: z.literal('datetime'),
	value: z.string()
		.min(1)
		.max(2000)
		.describe('Expression that evaluates to an ISO 8601 datetime'),
});

const DurationExpressionSchema = BaseExpressionSchema.extend({
	type: z.literal('duration'),
	value: z.string()
		.min(1)
		.max(2000)
		.describe('Expression that evaluates to an ISO 8601 duration string'),
});

// ============================================================================
// Object Types (value is an object with expression strings for each property)
// ============================================================================

export const MoneyExpressionSchema = BaseExpressionSchema.extend({
	type: z.literal('money'),
	value: z.object({
		amount: ExpressionString,
		currency: ExpressionString,
	}).strict().describe('Money object with amount and currency expressions'),
});

const AddressExpressionSchema = BaseExpressionSchema.extend({
	type: z.literal('address'),
	value: z.object({
		line1: ExpressionString,
		line2: OptionalExpressionString,
		locality: ExpressionString,
		region: ExpressionString,
		postalCode: ExpressionString,
		country: ExpressionString,
	}).strict().describe('Address object with component expressions'),
});

const PhoneExpressionSchema = BaseExpressionSchema.extend({
	type: z.literal('phone'),
	value: z.object({
		number: ExpressionString,
		type: OptionalExpressionString,
		extension: OptionalExpressionString,
	}).strict().describe('Phone object with number and optional type/extension expressions'),
});

const CoordinateExpressionValueSchema = z.object({
	lat: ExpressionString,
	lon: ExpressionString,
}).strict();

const CoordinateExpressionSchema = BaseExpressionSchema.extend({
	type: z.literal('coordinate'),
	value: CoordinateExpressionValueSchema.describe('Coordinate object with latitude and longitude expressions'),
});

const BboxExpressionSchema = BaseExpressionSchema.extend({
	type: z.literal('bbox'),
	value: z.object({
		southWest: CoordinateExpressionValueSchema.describe('Southwest (minimum) corner expressions'),
		northEast: CoordinateExpressionValueSchema.describe('Northeast (maximum) corner expressions'),
	}).strict().describe('Bounding box with southwest and northeast corner expressions'),
});

const PersonExpressionSchema = BaseExpressionSchema.extend({
	type: z.literal('person'),
	value: z.object({
		name: ExpressionString,
		title: OptionalExpressionString,
		firstName: OptionalExpressionString,
		middleName: OptionalExpressionString,
		lastName: OptionalExpressionString,
		suffix: OptionalExpressionString,
	}).strict().describe('Person object with name component expressions'),
});

const OrganizationExpressionSchema = BaseExpressionSchema.extend({
	type: z.literal('organization'),
	value: z.object({
		name: ExpressionString,
		legalName: OptionalExpressionString,
		domicile: OptionalExpressionString,
		entityType: OptionalExpressionString,
		entityId: OptionalExpressionString,
		taxId: OptionalExpressionString,
	}).strict().describe('Organization object with component expressions'),
});

const IdentificationExpressionSchema = BaseExpressionSchema.extend({
	type: z.literal('identification'),
	value: z.object({
		type: ExpressionString,
		number: ExpressionString,
		issuer: OptionalExpressionString,
		issueDate: OptionalExpressionString,
		expiryDate: OptionalExpressionString,
	}).strict().describe('Identification object with type, number, and optional issuer/date expressions'),
});

// ============================================================================
// Discriminated Union
// ============================================================================

// The scalar and object variants, in one place each, so the union and the
// lists of valid `type` values below can never drift apart.
const SCALAR_EXPRESSION_SCHEMAS = [
	BooleanExpressionSchema,
	StringExpressionSchema,
	NumberExpressionSchema,
	IntegerExpressionSchema,
	PercentageExpressionSchema,
	RatingExpressionSchema,
	DateExpressionSchema,
	TimeExpressionSchema,
	DatetimeExpressionSchema,
	DurationExpressionSchema,
] as const;

const OBJECT_EXPRESSION_SCHEMAS = [
	MoneyExpressionSchema,
	AddressExpressionSchema,
	PhoneExpressionSchema,
	CoordinateExpressionSchema,
	BboxExpressionSchema,
	PersonExpressionSchema,
	OrganizationExpressionSchema,
	IdentificationExpressionSchema,
] as const;

/**
 * Logic Expression Union Schema
 *
 * A discriminated union of all supported expression types.
 * The `type` property determines which schema variant applies.
 */
export const ExpressionSchema = z.discriminatedUnion('type', [
	...SCALAR_EXPRESSION_SCHEMAS,
	...OBJECT_EXPRESSION_SCHEMAS,
]).meta({
	title: 'Expression',
	description: 'A typed computed value with optional metadata (label, description). The type property determines the expected result type and value schema.',
});

// ============================================================================
// Expression type lists, derived from the union's variants
// ============================================================================

/** Scalar expression types (value is a string expression) */
export const SCALAR_EXPRESSION_TYPES = SCALAR_EXPRESSION_SCHEMAS.map((schema) => schema.shape.type.value);

/** Object expression types (value is an object with property expressions) */
export const OBJECT_EXPRESSION_TYPES = OBJECT_EXPRESSION_SCHEMAS.map((schema) => schema.shape.type.value);

/** All supported expression types */
export const ALL_EXPRESSION_TYPES = [...SCALAR_EXPRESSION_TYPES, ...OBJECT_EXPRESSION_TYPES];
