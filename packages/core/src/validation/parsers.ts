/**
 * Primitive Parsers
 *
 * Ready-to-use parse functions for all Paradoc primitives.
 * These use Zod schemas directly for strict validation.
 */

import type {
	Address,
	Bbox,
	Coordinate,
	Duration,
	Identification,
	Metadata,
	Money,
	Organization,
	Person,
	Phone,
} from '@paradoc/types'
import {
	AddressSchema,
	BboxSchema,
	CoordinateSchema,
	DurationSchema,
	IdentificationSchema,
	MetadataSchema,
	MoneySchema,
	OrganizationSchema,
	PersonSchema,
	PhoneSchema,
} from '@paradoc/schemas'
import { type ZodType, type ZodError } from 'zod'

interface ParserOptions {
	/** Fields that must be finite numbers (not NaN or Infinity) */
	finiteNumbers?: string[]
	/** Fields that must not be NaN */
	noNaN?: string[]
	/** Custom validation after schema validation */
	postValidate?: (data: unknown) => void
}

/**
 * Format Zod error for display
 */
function formatZodError(error: ZodError, schemaName: string): string {
	const firstIssue = error.issues[0]
	if (!firstIssue) return `Invalid ${schemaName}: validation failed`

	const path = firstIssue.path.length > 0 ? ` at ${firstIssue.path.join('.')}` : ''
	return `Invalid ${schemaName}${path}: ${firstIssue.message}`
}

/**
 * Check numeric fields for NaN/Infinity
 */
function checkNumericFields(
	data: Record<string, unknown>,
	typeName: string,
	options: ParserOptions,
): void {
	if (options.finiteNumbers) {
		for (const field of options.finiteNumbers) {
			const value = data[field]
			if (typeof value === 'number') {
				if (isNaN(value)) {
					throw new Error(`Invalid ${typeName}: ${field} must be a valid number`)
				}
				if (!isFinite(value)) {
					throw new Error(`Invalid ${typeName}: ${field} cannot be Infinity`)
				}
			}
		}
	}
	if (options.noNaN) {
		for (const field of options.noNaN) {
			const value = data[field]
			if (typeof value === 'number' && isNaN(value)) {
				throw new Error(`Invalid ${typeName}: ${field} must be a valid number`)
			}
		}
	}
}

/**
 * Factory to create a parser function using Zod schema directly
 */
function createParser<T>(
	schemaName: string,
	schema: ZodType<T>,
	options: ParserOptions = {},
): (input: unknown) => T {
	return (input: unknown): T => {
		const result = schema.safeParse(input)

		if (!result.success) {
			throw new Error(formatZodError(result.error, schemaName))
		}

		const data = result.data as Record<string, unknown>

		// Check numeric fields
		checkNumericFields(data, schemaName, options)

		// Run custom post-validation if provided
		if (options.postValidate) {
			options.postValidate(data)
		}

		return data as T
	}
}

// ─────────────────────────────────────────────────────────────
// Primitive Parsers
// ─────────────────────────────────────────────────────────────

export const parseMoney = createParser<Money>('Money', MoneySchema, {
	finiteNumbers: ['amount'],
})

export const parseCoordinate = createParser<Coordinate>('Coordinate', CoordinateSchema, {
	noNaN: ['lat', 'lon'],
})

export const parseBbox = createParser<Bbox>('Bbox', BboxSchema, {
	postValidate: (data) => {
		const bbox = data as Bbox
		if (bbox.southWest.lat >= bbox.northEast.lat) {
			throw new Error(
				`Invalid Bbox: southWest.lat (${bbox.southWest.lat}) must be less than northEast.lat (${bbox.northEast.lat})`,
			)
		}
		if (bbox.southWest.lon >= bbox.northEast.lon) {
			throw new Error(
				`Invalid Bbox: southWest.lon (${bbox.southWest.lon}) must be less than northEast.lon (${bbox.northEast.lon})`,
			)
		}
	},
})

export const parseAddress = createParser<Address>('Address', AddressSchema)

export const parsePerson = createParser<Person>('Person', PersonSchema)

export const parseOrganization = createParser<Organization>('Organization', OrganizationSchema)

export const parsePhone = createParser<Phone>('Phone', PhoneSchema)

export const parseIdentification = createParser<Identification>(
	'Identification',
	IdentificationSchema,
)

export const parseMetadata = createParser<Metadata>('Metadata', MetadataSchema)

export const parseDuration = createParser<Duration>('Duration', DurationSchema)
