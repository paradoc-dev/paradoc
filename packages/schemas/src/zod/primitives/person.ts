import { z } from 'zod';

export const PersonSchema = z.object({
	name: z.string()
		.min(1)
		.max(200)
		.describe("Person's full name (complete name as a single string)"),
	title: z.string()
		.min(1)
		.max(50)
		.describe('Name prefix or title (e.g., Mr., Mrs., Dr., Prof.)')
		.optional(),
	firstName: z.string()
		.min(1)
		.max(100)
		.describe("Person's first or given name")
		.optional(),
	middleName: z.string()
		.min(1)
		.max(100)
		.describe("Person's middle name or initial")
		.optional(),
	lastName: z.string()
		.min(1)
		.max(100)
		.describe("Person's last name or surname")
		.optional(),
	suffix: z.string()
		.min(1)
		.max(50)
		.describe('Name suffix (e.g., Jr., Sr., III, Esq.)')
		.optional(),
}).meta({
	title: 'Person',
	description: 'Person with name (required) and optional name components (title, first name, middle name, last name, suffix)',
});
