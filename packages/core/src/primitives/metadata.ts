import { parseMetadata } from '@/validation';
import type { Metadata } from '@paradoc/types';

export interface MetadataBuilder {
	from(value: Metadata): MetadataBuilder;
	build(): Metadata;
}

function createBuilder(): MetadataBuilder {
	const _def: Metadata = {};

	const builder: MetadataBuilder = {
		from(value) {
			const parsed = parseMetadata(value);
			Object.assign(_def, parsed);
			return builder;
		},
		build() {
			return parseMetadata(_def);
		},
	};

	return builder;
}

type MetadataAPI = {
	(): MetadataBuilder;
	(input: Metadata): Metadata;
	parse(input: unknown): Metadata;
	safeParse(
		input: unknown,
	): { success: true; data: Metadata } | { success: false; error: Error };
};

function metadataImpl(): MetadataBuilder;
function metadataImpl(input: Metadata): Metadata;
function metadataImpl(input?: Metadata): MetadataBuilder | Metadata {
	if (input !== undefined) {
		return parseMetadata(input);
	}
	return createBuilder();
}

export const metadata: MetadataAPI = Object.assign(metadataImpl, {
	parse: parseMetadata,
	safeParse: (
		input: unknown,
	): { success: true; data: Metadata } | { success: false; error: Error } => {
		try {
			return { success: true, data: parseMetadata(input) };
		} catch (err) {
			return { success: false, error: err as Error };
		}
	},
});
