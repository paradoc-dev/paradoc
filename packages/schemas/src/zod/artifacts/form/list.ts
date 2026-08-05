import type { ListField } from '@paradoc/types';
import { z } from 'zod';
import { BaseFieldSchema } from './base-field';
import { FormFieldSchema } from './field';

export const ListFieldSchema: z.ZodType<ListField> = BaseFieldSchema.extend({
	type: z.literal('list'),
	item: z.lazy(() => FormFieldSchema),
	minItems: z.number().int().min(0).describe('Minimum number of items').optional(),
	maxItems: z.number().int().min(0).describe('Maximum number of items').optional(),
}).superRefine((field, ctx) => {
	if (field.minItems !== undefined && field.maxItems !== undefined && field.minItems > field.maxItems) {
		ctx.addIssue({
			code: 'custom',
			path: ['maxItems'],
			message: 'maxItems must be greater than or equal to minItems',
		});
	}
}).meta({ id: 'ListField' });
