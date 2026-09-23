import { z } from 'zod';

/** ISO 4217 alpha-3 currency code. */
export const CurrencyCodeSchema = z.string()
	.min(3)
	.max(3)
	.regex(/^[A-Z]{3}$/);

export const MoneySchema = z.object({
	amount: z.number()
		.describe('Monetary amount expressed in decimal form (e.g., 99.99 for USD). Negative values allowed for debts/credits'),
	currency: CurrencyCodeSchema
		.describe('ISO 4217 alpha-3 currency code (e.g., USD, EUR, GBP)'),
}).meta({
	title: 'Money',
	description: 'Monetary value with currency code. Represents an amount in a specific currency, supporting both positive and negative values',
}).strict();
