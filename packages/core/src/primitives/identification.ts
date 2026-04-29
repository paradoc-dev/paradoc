import { parseIdentification } from '@/validation';
import type { Identification } from '@paradoc/types';

export interface IdentificationBuilder {
	from(value: Identification): IdentificationBuilder;
	type(value: string): IdentificationBuilder;
	number(value: string): IdentificationBuilder;
	issuer(value: string | undefined): IdentificationBuilder;
	issueDate(value: string | undefined): IdentificationBuilder;
	expiryDate(value: string | undefined): IdentificationBuilder;
	build(): Identification;
}

function createBuilder(): IdentificationBuilder {
	const _def: Partial<Identification> = {};

	const builder: IdentificationBuilder = {
		from(value) {
			const parsed = parseIdentification(value);
			Object.assign(_def, parsed);
			return builder;
		},
		type(value) {
			_def.type = value;
			return builder;
		},
		number(value) {
			_def.number = value;
			return builder;
		},
		issuer(value) {
			_def.issuer = value;
			return builder;
		},
		issueDate(value) {
			_def.issueDate = value;
			return builder;
		},
		expiryDate(value) {
			_def.expiryDate = value;
			return builder;
		},
		build() {
			return parseIdentification(_def);
		},
	};

	return builder;
}

type IdentificationAPI = {
	(): IdentificationBuilder;
	(input: Identification): Identification;
	parse(input: unknown): Identification;
	safeParse(
		input: unknown,
	): { success: true; data: Identification } | { success: false; error: Error };
};

function identificationImpl(): IdentificationBuilder;
function identificationImpl(input: Identification): Identification;
function identificationImpl(input?: Identification): IdentificationBuilder | Identification {
	if (input !== undefined) {
		return parseIdentification(input);
	}
	return createBuilder();
}

export const identification: IdentificationAPI = Object.assign(identificationImpl, {
	parse: parseIdentification,
	safeParse: (
		input: unknown,
	): { success: true; data: Identification } | { success: false; error: Error } => {
		try {
			return { success: true, data: parseIdentification(input) };
		} catch (err) {
			return { success: false, error: err as Error };
		}
	},
});
