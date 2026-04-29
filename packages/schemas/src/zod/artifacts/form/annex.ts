import { z } from 'zod';
import { CondExprSchema } from '../expressions/cond-expr';

export const FormAnnexSchema = z.object({
	title: z.string()
		.min(1)
		.max(200)
		.describe('Title or heading for the annex slot')
		.optional(),
	description: z.string()
		.min(1)
		.max(1000)
		.describe('Description of what document should be attached')
		.optional(),
	required: CondExprSchema.optional(),
	visible: CondExprSchema.optional(),
	order: z.number()
		.min(0)
		.describe('Display order for rendering')
		.optional(),
}).meta({
	title: 'FormAnnex',
	description: 'Defines an annex slot where a document must or may be attached at runtime',
}).strict();
