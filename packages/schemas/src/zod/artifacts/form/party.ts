import { z } from 'zod';
import { CondExprSchema } from '../expressions/cond-expr';
import { MoneyExpressionSchema } from '../expressions/expression';
import { MoneySchema } from '../../primitives';

const FormSignatureSchema = z.object({
	required: z.boolean()
		.describe('Whether signature is required for this role (default: false)')
		.optional(),
	witnesses: z.number()
		.int()
		.min(0)
		.describe('Number of witnesses required for this signature (default: 0)')
		.optional(),
	notarized: z.boolean()
		.describe('Whether at least one witness must be a notary (default: false)')
		.optional(),
}).strict().meta({
	title: 'FormSignature',
	description: 'Design-time signature requirements for a party role',
});

const FormPaymentSchema = z.object({
	required: z.boolean()
		.describe('Whether payment is required for this role (default: false)')
		.optional(),
	amount: z.union([
		MoneySchema,
		MoneyExpressionSchema,
	]).describe('Amount owed: a fixed Money value, or a MoneyExpression resolved from filled data at request time'),
}).strict().meta({
	title: 'FormPayment',
	description: 'Design-time payment requirement for a party role',
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
	])
		.describe('Constraint on party type (default: any)')
		.optional(),
	min: z.number()
		.int()
		.min(0)
		.describe('Minimum parties required (default: 1)')
		.optional(),
	max: z.number()
		.int()
		.min(1)
		.describe('Maximum parties allowed (default: 1)')
		.optional(),
	required: CondExprSchema.optional(),
	signature: FormSignatureSchema.optional(),
	payment: FormPaymentSchema.optional(),
}).strict().superRefine((party, ctx) => {
	const min = party.min ?? 1
	const max = party.max ?? 1
	if (min > max) {
		ctx.addIssue({
			code: 'custom',
			path: ['max'],
			message: 'max must be greater than or equal to min',
		})
	}
}).meta({
	title: 'FormParty',
	description: 'Design-time party role definition. Defines what roles exist and what constraints apply when filling a form.',
});
