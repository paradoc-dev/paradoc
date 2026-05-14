import { parseMoney } from '@/validation';
import type { Money } from '@paradoc/types';

export interface MoneyBuilder {
	from(value: Money): MoneyBuilder;
	amount(value: number): MoneyBuilder;
	currency(value: string): MoneyBuilder;
	build(): Money;
}

function createBuilder(): MoneyBuilder {
	const _def: Partial<Money> = {};

	const builder: MoneyBuilder = {
		from(value) {
			const parsed = parseMoney(value);
			_def.amount = parsed.amount;
			_def.currency = parsed.currency;
			return builder;
		},
		amount(value) {
			_def.amount = value;
			return builder;
		},
		currency(value) {
			_def.currency = value;
			return builder;
		},
		build() {
			return parseMoney(_def);
		},
	};

	return builder;
}

type MoneyAPI = {
	(): MoneyBuilder;
	(input: Money): Money;
	parse(input: unknown): Money;
	safeParse(
		input: unknown,
	): { success: true; data: Money } | { success: false; error: Error };
};

function moneyImpl(): MoneyBuilder;
function moneyImpl(input: Money): Money;
function moneyImpl(input?: Money): MoneyBuilder | Money {
	if (input !== undefined) {
		return parseMoney(input);
	}
	return createBuilder();
}

export const money: MoneyAPI = Object.assign(moneyImpl, {
	parse: parseMoney,
	safeParse: (
		input: unknown,
	): { success: true; data: Money } | { success: false; error: Error } => {
		try {
			return { success: true, data: parseMoney(input) };
		} catch (err) {
			return { success: false, error: err as Error };
		}
	},
});
