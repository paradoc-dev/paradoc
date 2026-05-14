import { parseAddress } from '@/validation';
import type { Address } from '@paradoc/types';

export interface AddressBuilder {
	from(value: Address): AddressBuilder;
	line1(value: string): AddressBuilder;
	line2(value: string | undefined): AddressBuilder;
	locality(value: string): AddressBuilder;
	region(value: string): AddressBuilder;
	postalCode(value: string): AddressBuilder;
	country(value: string): AddressBuilder;
	build(): Address;
}

function createBuilder(): AddressBuilder {
	const _def: Partial<Address> = {};

	const builder: AddressBuilder = {
		from(value) {
			const parsed = parseAddress(value);
			Object.assign(_def, parsed);
			return builder;
		},
		line1(value) {
			_def.line1 = value;
			return builder;
		},
		line2(value) {
			_def.line2 = value;
			return builder;
		},
		locality(value) {
			_def.locality = value;
			return builder;
		},
		region(value) {
			_def.region = value;
			return builder;
		},
		postalCode(value) {
			_def.postalCode = value;
			return builder;
		},
		country(value) {
			_def.country = value;
			return builder;
		},
		build() {
			return parseAddress(_def);
		},
	};

	return builder;
}

type AddressAPI = {
	(): AddressBuilder;
	(input: Address): Address;
	parse(input: unknown): Address;
	safeParse(
		input: unknown,
	): { success: true; data: Address } | { success: false; error: Error };
};

function addressImpl(): AddressBuilder;
function addressImpl(input: Address): Address;
function addressImpl(input?: Address): AddressBuilder | Address {
	if (input !== undefined) {
		return parseAddress(input);
	}
	return createBuilder();
}

export const address: AddressAPI = Object.assign(addressImpl, {
	parse: parseAddress,
	safeParse: (
		input: unknown,
	): { success: true; data: Address } | { success: false; error: Error } => {
		try {
			return { success: true, data: parseAddress(input) };
		} catch (err) {
			return { success: false, error: err as Error };
		}
	},
});
