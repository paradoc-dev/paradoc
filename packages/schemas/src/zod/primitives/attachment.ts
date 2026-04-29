import { z } from 'zod';

export const AttachmentSchema = z.object({
	name: z.string()
		.min(1)
		.max(255)
		.describe('Original file name'),
	mimeType: z.string()
		.min(1)
		.max(100)
		.describe('MIME type of the attached file'),
	checksum: z.string()
		.regex(/^sha256:[a-f0-9]{64}$/)
		.describe('SHA-256 checksum for integrity verification')
		.optional(),
}).meta({
	title: 'Attachment',
	description: 'Attachment data representing an attached document. The key in the record is the annex identifier (the key from form.annexes).',
}).strict();
