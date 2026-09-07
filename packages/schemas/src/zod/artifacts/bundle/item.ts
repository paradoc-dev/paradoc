import { z } from 'zod';
import { CondExprSchema } from '../expressions/cond-expr';
import { ChecklistSchema } from '../checklist';
import { DocumentSchema } from '../document';
import { FormSchema } from '../form';
import { BundleSchema } from './index';

/**
 * Base properties shared by path and registry bundle content items.
 */
const ContentItemBaseSchema = z.object({
	key: z.string()
		.min(1)
		.max(100)
		.regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/)
		.describe('Unique identifier for this content item, used to reference it in defs expressions'),
	include: CondExprSchema.optional(),
});

/**
 * Inline content item — artifact defined directly within the bundle.
 */
type InlineContentItemShape = {
	type: z.ZodLiteral<'inline'>;
	key: z.ZodString;
	artifact: z.ZodLazy<z.ZodUnion<readonly [
		typeof DocumentSchema,
		typeof FormSchema,
		typeof ChecklistSchema,
		typeof BundleSchema,
	]>>;
};

const InlineContentItemSchema: z.ZodObject<InlineContentItemShape, z.core.$strict> = z.object({
	type: z.literal('inline'),
	key: z.string()
		.min(1)
		.max(100)
		.regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/)
		.describe('Unique identifier for this content item, used to reference it in defs expressions'),
	artifact: z.lazy(() => z.union([
		DocumentSchema,
		FormSchema,
		ChecklistSchema,
		BundleSchema,
	]))
		.describe('Inline artifact definition (document, form, checklist, or nested bundle)'),
}).strict();

/**
 * Path content item — references an artifact in the same repo by path.
 */
const PathContentItemSchema = ContentItemBaseSchema.extend({
	type: z.literal('path'),
	path: z.string()
		.min(1)
		.describe('Absolute path from repo root to the artifact file'),
}).strict();

/**
 * Registry content item — references a published artifact by slug.
 */
const RegistryContentItemSchema = ContentItemBaseSchema.extend({
	type: z.literal('registry'),
	slug: z.string()
		.min(1)
		.describe('Resource slug in format @org/repo/resource or @org/repo/resource@version'),
}).strict();

/**
 * Bundle content item — one of three types:
 * - { type: 'inline', key, artifact } - inline artifact definition
 * - { type: 'path', key, path, include? } - reference by path from repo root
 * - { type: 'registry', key, slug, include? } - reference by registry slug
 */
export const BundleContentItemSchema: z.ZodDiscriminatedUnion<[
	typeof InlineContentItemSchema,
	typeof PathContentItemSchema,
	typeof RegistryContentItemSchema,
], 'type'> = z.discriminatedUnion('type', [
	InlineContentItemSchema,
	PathContentItemSchema,
	RegistryContentItemSchema,
]).describe('Bundle content item: an inline artifact, path reference, or registry reference with optional include condition');
