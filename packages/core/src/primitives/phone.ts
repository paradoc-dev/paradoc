import { parsePhone } from '@/validation';
import type { Phone } from '@paradoc/types';

export interface PhoneBuilder {
	from(value: Phone): PhoneBuilder;
	number(value: string): PhoneBuilder;
	type(value: string | undefined): PhoneBuilder;
	extension(value: string | undefined): PhoneBuilder;
	build(): Phone;
}

function createBuilder(): PhoneBuilder {
	const _def: Partial<Phone> = {};

	const builder: PhoneBuilder = {
		from(value) {
			const parsed = parsePhone(value);
			Object.assign(_def, parsed);
			return builder;
		},
		number(value) {
			_def.number = value;
			return builder;
		},
		type(value) {
			_def.type = value;
			return builder;
		},
		extension(value) {
			_def.extension = value;
			return builder;
		},
		build() {
			return parsePhone(_def);
		},
	};

	return builder;
}

type PhoneAPI = {
	(): PhoneBuilder;
	(input: Phone): Phone;
	parse(input: unknown): Phone;
	safeParse(
		input: unknown,
	): { success: true; data: Phone } | { success: false; error: Error };
};

function phoneImpl(): PhoneBuilder;
function phoneImpl(input: Phone): Phone;
function phoneImpl(input?: Phone): PhoneBuilder | Phone {
	if (input !== undefined) {
		return parsePhone(input);
	}
	return createBuilder();
}

export const phone: PhoneAPI = Object.assign(phoneImpl, {
	parse: parsePhone,
	safeParse: (
		input: unknown,
	): { success: true; data: Phone } | { success: false; error: Error } => {
		try {
			return { success: true, data: parsePhone(input) };
		} catch (err) {
			return { success: false, error: err as Error };
		}
	},
});
