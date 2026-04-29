import { z } from 'zod';

export const AddressSchema = z.object({
	line1: z.string()
		.min(1)
		.max(200)
		.describe('Primary address line'),
	line2: z.string()
		.max(200)
		.describe('Secondary address line')
		.optional(),
	locality: z.string()
		.min(1)
		.max(200)
		.describe('City or locality name'),
	region: z.string()
		.min(1)
		.max(100)
		.describe('State, province, or region name'),
	postalCode: z.string()
		.min(3)
		.max(20)
		.regex(/^[A-Z0-9\s-]+$/)
		.describe('Postal or ZIP code'),
	country: z.string()
		.min(2)
		.max(100)
		.describe('ISO 3166-1 country code (e.g., "US", "GB", "FRA") or full country name'),
}).meta({
	title: 'Address',
	description: 'Physical address with street, locality, region, postal code, and country',
}).strict();
