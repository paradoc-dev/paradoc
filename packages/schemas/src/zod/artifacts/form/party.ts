import { z } from 'zod';
import { CondExprSchema } from '../expressions/cond-expr';

const FormSignatureSchema = z.object({
	required: z.boolean()
		.default(false)
		.describe('Whether signature is required for this role')
		.optional(),
	witnesses: z.number()
		.min(0)
		.default(0)
		.describe('Number of witnesses required for this signature')
		.optional(),
	notarized: z.boolean()
		.default(false)
		.describe('Whether at least one witness must be a notary')
		.optional(),
}).meta({
	title: 'FormSignature',
	description: 'Design-time signature requirements for a party role',
});

/**
 * Design-time party role definition.
 * Defines what roles exist and what constraints apply when filling a form.
 */
export const FormPartySchema = z.object({
	label: z.string()
		.min(1)
		.max(100)
		.describe('Display name for this role'),
	description: z.string()
		.max(500)
		.describe('Description of this role')
		.optional(),
	partyType: z.union([
		z.literal('person'),
		z.literal('organization'),
		z.literal('any'),
	]).default('any')
		.describe('Constraint on party type')
		.optional(),
	min: z.number()
		.min(0)
		.default(1)
		.describe('Minimum parties required')
		.optional(),
	max: z.number()
		.min(1)
		.default(1)
		.describe('Maximum parties allowed')
		.optional(),
	required: CondExprSchema.optional(),
	signature: FormSignatureSchema.optional(),
}).meta({
	title: 'FormParty',
	description: 'Design-time party role definition. Defines what roles exist and what constraints apply when filling a form.',
});
