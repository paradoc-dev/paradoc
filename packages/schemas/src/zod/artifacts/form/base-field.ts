import { z } from 'zod';
import { CondExprSchema } from '../expressions/cond-expr';

export const BaseFieldSchema = z.object({
	label: z.string().min(1).max(200).describe('Display label for the field').optional(),
	description: z.string().min(1).max(1000).describe('Description or help text for the field').optional(),
	required: CondExprSchema.optional(),
	visible: CondExprSchema.optional(),
});
