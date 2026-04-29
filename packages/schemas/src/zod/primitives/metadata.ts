import { z } from 'zod';

export const MetadataSchema = z.record(
	z.string()
		.min(1)
		.max(100)
		.regex(/^[A-Za-z0-9]([A-Za-z0-9]|-[A-Za-z0-9])*$/)
		.describe('Metadata key identifier. Must start with alphanumeric character and can contain alphanumeric characters and hyphens'),
	z.union([
		z.string().max(500).describe('Metadata value as a string (max 500 characters)'),
		z.number().describe('Metadata value as a number'),
		z.boolean().describe('Metadata value as a boolean'),
		z.null().describe('Metadata value as null'),
	]),
).meta({
	title: 'Metadata',
	description: 'Custom key-value pairs for storing domain-specific or organizational metadata. Keys must be alphanumeric with hyphens, values can be strings, numbers, booleans, or null',
});
