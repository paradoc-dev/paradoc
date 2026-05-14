import { z } from 'zod';
import { ArtifactSchema } from '../shared/base';
import { LayerSchema } from '../shared/layer';

/**
 * Document artifact — a static content artifact with no inputs.
 */
export const DocumentSchema = ArtifactSchema.extend({
	kind: z.literal('document'),
	layers: z.record(
		z.string()
			.min(1)
			.max(100)
			.regex(/^[a-z][a-zA-Z0-9_]*$/)
			.describe('Layer identifier (camelCase, starts with lowercase letter)'),
		LayerSchema,
	).describe('Named layers for rendering this document into different formats. Keys are user-defined identifiers (e.g., markdown, pdf, html)')
		.optional(),
	defaultLayer: z.string()
		.min(1)
		.max(100)
		.describe('Key of the default layer to use when none specified at render time')
		.optional(),
}).meta({
	title: 'Document',
	description: 'A document artifact representing static content with no inputs. Documents can have multiple layers for rendering to different output formats (e.g., PDF, Markdown, HTML).',
}).strict();
