import { z } from 'zod';
import { ChecksumSchema } from './checksum';

export const AttachmentSchema = z.object({
	name: z.string()
		.min(1)
		.max(255)
		.describe('Original file name'),
	mimeType: z.string()
		.min(1)
		.max(100)
		.describe('MIME type of the attached file'),
	checksum: ChecksumSchema.optional(),
}).strict().meta({
	title: 'Attachment',
	description: 'Attachment data representing an attached document. The key in the record is the annex identifier (the key from form.annexes).',
});
