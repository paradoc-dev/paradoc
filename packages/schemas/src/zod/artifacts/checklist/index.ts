import { z } from 'zod';
import { ArtifactSchema } from '../shared/base';
import { LayerSchema } from '../shared/layer';
import { ChecklistItemSchema } from './item';

// Re-export item schema
export { ChecklistItemSchema } from './item';

export const ChecklistSchema = ArtifactSchema.extend({
	kind: z.literal('checklist'),
	items: z.array(ChecklistItemSchema)
		.describe('Array of checklist items. Each item represents a task, step, or requirement.'),
	layers: z.record(
		z.string()
			.min(1)
			.max(100)
			.regex(/^[a-z][a-zA-Z0-9_]*$/)
			.describe('Layer identifier (camelCase, starts with lowercase letter)'),
		LayerSchema,
	).describe('Named layers for rendering this checklist into different formats. Keys are user-defined identifiers (e.g., markdown, pdf, html)')
		.optional(),
	defaultLayer: z.string()
		.min(1)
		.max(100)
		.describe('Key of the default layer to use when none specified at render time')
		.optional(),
}).meta({
	title: 'Checklist',
	description: 'A checklist artifact containing an ordered list of items to track. Each item may define how its status should be represented at runtime (boolean or enum).',
}).strict();
