import { z } from 'zod';

export const SignatureSchema = z.object({
	image: z.string()
		.min(1)
		.describe('Base64-encoded signature image or data URI')
		.optional(),
	timestamp: z.iso.datetime()
		.describe('ISO 8601 date-time when the signature was captured'),
	method: z.union([
		z.literal('drawn'),
		z.literal('typed'),
		z.literal('uploaded'),
		z.literal('certificate'),
	]).describe('Method used to capture the signature'),
	type: z.union([
		z.literal('signature'),
		z.literal('initials'),
	]).default('signature')
		.describe('Whether this is a full signature or initials')
		.optional(),
	metadata: z.record(z.string(), z.unknown())
		.describe('Additional metadata (IP address, device info, etc.)')
		.optional(),
}).meta({
	title: 'Signature',
	description: 'Captured signature data containing the signature image, timestamp, capture method, and optional metadata.',
}).strict();
