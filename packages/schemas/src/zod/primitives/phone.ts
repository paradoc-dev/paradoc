import { z } from 'zod';

export const PhoneSchema = z.object({
	number: z.string()
		.min(8)
		.max(16)
		.regex(/^\+[1-9]\d{1,14}$/)
		.describe('Phone number in E.164 international format (e.g., +14155552671)'),
	type: z.string()
		.min(1)
		.max(50)
		.describe('Type or category of phone number (e.g., mobile, work, home)')
		.optional(),
	extension: z.string()
		.min(1)
		.max(20)
		.describe('Phone extension or extension number')
		.optional(),
}).meta({
	title: 'Phone',
	description: 'Phone number in E.164 international format with optional type and extension',
}).strict();
