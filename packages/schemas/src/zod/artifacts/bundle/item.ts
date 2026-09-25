import { z } from 'zod';
import { CondExprSchema } from '../expressions/cond-expr';
import { ChecklistSchema } from '../checklist';
import { DocumentSchema } from '../document';
import { FormSchema } from '../form';
import type { Bundle } from '@paradoc/types';
import { ArtifactSchema } from '../shared/base';
import { DefsSectionSchema } from '../expressions/defs-section';
import { addDuplicateIdentityIssues } from '../shared/unique';

/**
 * Base properties shared by every bundle content item with an optional
 * membership condition. The source-specific payload remains below.
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
 * Inline content item — artifact defined directly within the bundle. The
 * recursive `artifact` needs an explicit shape type, so it is stated here.
 */
type InlineContentItemShape = typeof ContentItemBaseSchema.shape & {
	type: z.ZodLiteral<'inline'>;
	artifact: z.ZodLazy<z.ZodUnion<readonly [
		typeof DocumentSchema,
		typeof FormSchema,
		typeof ChecklistSchema,
		typeof BundleSchema,
	]>>;
};

const InlineContentItemSchema: z.ZodObject<InlineContentItemShape, z.core.$strict> = ContentItemBaseSchema.extend({
	type: z.literal('inline'),
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
		.describe("Path to the artifact file, relative to the bundle file's directory"),
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

export const BundleObjectSchema = ArtifactSchema.extend({
	kind: z.literal('bundle'),
	defs: DefsSectionSchema.optional(),
	contents: z.array(z.lazy(() => BundleContentItemSchema))
		.superRefine((contents, ctx) => {
			addDuplicateIdentityIssues(
				contents,
				(content) => content.key,
				{ collection: 'contents', property: 'key', label: 'bundle content key' },
				(path, message) => ctx.addIssue({ code: 'custom', path, message }),
			);
		})
		.describe('Ordered bundle contents. Each item has a key and is either an inline artifact, path reference, or registry reference.'),
}).strict().meta({
	title: 'Bundle',
	description: 'A bundle artifact that groups together related artifacts into a single distributable unit. Bundles can contain documents, forms, checklists, and other bundles.',
});

export const BundleSchema: z.ZodType<Bundle> = BundleObjectSchema;

/**
 * Bundle content item — one of three types:
 * - { type: 'inline', key, artifact, include? } - inline artifact definition
 * - { type: 'path', key, path, include? } - reference relative to the bundle file's directory
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
]).meta({
	title: 'BundleContentItem',
	description: 'Bundle content item: an inline artifact, path reference, or registry reference with optional include condition',
});
