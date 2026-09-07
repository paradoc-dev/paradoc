import { z } from 'zod';
import type { Bundle } from '@paradoc/types';
import { ArtifactSchema } from '../shared/base';
import { DefsSectionSchema } from '../expressions/defs-section';
import { addDuplicateIdentityIssues } from '../shared/unique';
import { BundleContentItemSchema } from './item';

// Re-export item schema
export { BundleContentItemSchema } from './item';

/**
 * Bundle artifact — a recursive container for content artifacts.
 */
export const BundleSchema: z.ZodType<Bundle> = ArtifactSchema.extend({
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
}).meta({
	title: 'Bundle',
	description: 'A bundle artifact that groups together related artifacts into a single distributable unit. Bundles can contain documents, forms, checklists, and other bundles.',
}).strict();
