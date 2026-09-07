import type { ListField } from '@paradoc/types';
import { z } from 'zod';
import { BaseFieldSchema } from './base-field';
import { FormFieldSchema } from './field';
import { getOrderedBoundsIssue } from './ordered-bounds';

export const ListFieldSchema: z.ZodType<ListField> = BaseFieldSchema.extend({
	type: z.literal('list'),
	item: z.lazy(() => FormFieldSchema),
	minItems: z.number().int().min(0).describe('Minimum number of items').optional(),
	maxItems: z.number().int().min(0).describe('Maximum number of items').optional(),
}).superRefine((field, ctx) => {
	const issue = getOrderedBoundsIssue(
		field.minItems,
		field.maxItems,
		'minItems',
		'maxItems',
		(min, max) => min <= max,
	)
	if (issue) ctx.addIssue({ code: 'custom', ...issue })
}).meta({ id: 'ListField' });
