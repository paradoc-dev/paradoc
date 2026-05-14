import { z } from 'zod';

/**
 * Inline content reference — text embedded directly.
 */
const InlineContentRefSchema = z.object({
	kind: z.literal('inline'),
	text: z.string()
		.min(1)
		.max(1000000)
		.describe('Inline text content'),
}).meta({
	title: 'InlineContentRef',
	description: 'Inline content reference with embedded text',
}).strict();

/**
 * File content reference — references an external file by path.
 */
const FileContentRefSchema = z.object({
	kind: z.literal('file'),
	path: z.string()
		.min(1)
		.max(1000)
		.describe('Path to the content file'),
	mimeType: z.string()
		.min(1)
		.max(100)
		.describe('MIME type of the file content'),
	title: z.string()
		.min(1)
		.max(200)
		.describe('Human-readable title')
		.optional(),
	description: z.string()
		.min(1)
		.max(2000)
		.describe('Description of the content')
		.optional(),
	checksum: z.string()
		.min(1)
		.max(100)
		.regex(/^sha256:[a-f0-9]{64}$/)
		.describe('SHA-256 checksum for integrity verification')
		.optional(),
}).meta({
	title: 'FileContentRef',
	description: 'File content reference with path and metadata',
}).strict();

/**
 * Content reference — inline text or external file.
 * Used for instructions and agent instructions on artifacts.
 */
export const ContentRefSchema = z.discriminatedUnion('kind', [
	InlineContentRefSchema,
	FileContentRefSchema,
]).meta({
	title: 'ContentRef',
	description: 'Content reference — inline text or file reference',
});
