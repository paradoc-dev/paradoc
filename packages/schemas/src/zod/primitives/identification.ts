import { z } from 'zod';

export const IdentificationSchema = z.object({
	type: z.string()
		.min(1)
		.max(50)
		.describe('Type of identification document (e.g., ssn, passport, license, ein)'),
	number: z.string()
		.min(1)
		.max(100)
		.describe('Identification number or identifier'),
	issuer: z.string()
		.min(1)
		.max(100)
		.describe('Issuing authority, country, or state (e.g., US, CA, DMV)')
		.optional(),
	issueDate: z.iso.date()
		.describe('Issue date in ISO 8601 format (YYYY-MM-DD)')
		.optional(),
	expiryDate: z.iso.date()
		.describe('Expiry date in ISO 8601 format (YYYY-MM-DD)')
		.optional(),
}).meta({
	title: 'Identification',
	description: 'Identification document with type, number, issuer, and optional issue and expiry dates',
}).strict();
