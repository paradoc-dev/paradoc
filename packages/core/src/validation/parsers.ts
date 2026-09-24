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
import { createParser } from './zod-parser'

// ─────────────────────────────────────────────────────────────
// Primitive Parsers
// ─────────────────────────────────────────────────────────────

export const parseMoney = createParser<Money>('Money', MoneySchema)

export const parseCoordinate = createParser<Coordinate>('Coordinate', CoordinateSchema)

export const parseBbox = createParser<Bbox>('Bbox', BboxSchema, (bbox) => {
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
