import { z } from 'zod';

export const OrganizationSchema = z.object({
	name: z.string()
		.min(1)
		.max(200)
		.describe('Organization name'),
	legalName: z.string()
		.min(1)
		.max(200)
		.describe('Legal or registered name of the organization')
		.optional(),
	domicile: z.string()
		.min(1)
		.max(100)
		.describe('Domicile')
		.optional(),
	entityType: z.string()
		.min(1)
		.max(100)
		.describe('Legal entity type of the organization')
		.optional(),
	entityId: z.string()
		.min(1)
		.max(100)
		.describe('Business identification number')
		.optional(),
	taxId: z.string()
		.min(1)
		.max(100)
		.describe('Tax identification number')
		.optional(),
}).meta({
	title: 'Organization',
	description: 'Organization with legal details and identification',
});
