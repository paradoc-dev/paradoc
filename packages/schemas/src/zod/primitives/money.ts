import { z } from 'zod';

export const MoneySchema = z.object({
	amount: z.number()
		.describe('Monetary amount in the smallest currency unit (e.g., cents for USD) or as a decimal (e.g., 99.99 for USD). Negative values allowed for debts/credits'),
	currency: z.string()
		.min(3)
		.max(3)
		.regex(/^[A-Z]{3}$/)
		.describe('ISO 4217 alpha-3 currency code (e.g., USD, EUR, GBP)'),
}).meta({
	title: 'Money',
	description: 'Monetary value with currency code. Represents an amount in a specific currency, supporting both positive and negative values',
}).strict();
