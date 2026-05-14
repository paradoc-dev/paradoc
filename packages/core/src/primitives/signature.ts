import type { Signature } from '@paradoc/types';

export interface SignatureBuilder {
	from(value: Signature): SignatureBuilder;
	timestamp(value: string): SignatureBuilder;
	method(value: Signature['method']): SignatureBuilder;
	image(value: string): SignatureBuilder;
	metadata(value: Record<string, unknown>): SignatureBuilder;
	build(): Signature;
}

function createBuilder(): SignatureBuilder {
	const _data: Partial<Signature> = {};

	const builder: SignatureBuilder = {
		from(value) {
			Object.assign(_data, value);
			return builder;
		},
		timestamp(value) {
			_data.timestamp = value;
			return builder;
		},
		method(value) {
			_data.method = value;
			return builder;
		},
		image(value) {
			_data.image = value;
			return builder;
		},
		metadata(value) {
			_data.metadata = value;
			return builder;
		},
		build() {
			if (!_data.timestamp) {
				throw new Error('Signature timestamp is required');
			}
			if (!_data.method) {
				throw new Error('Signature method is required');
			}
			return _data as Signature;
		},
	};

	return builder;
}

type SignatureAPI = {
	(): SignatureBuilder;
	(input: Partial<Signature>): SignatureBuilder;
};

function signatureImpl(): SignatureBuilder;
function signatureImpl(input: Partial<Signature>): SignatureBuilder;
function signatureImpl(input?: Partial<Signature>): SignatureBuilder {
	const builder = createBuilder();
	if (input) {
		if (input.timestamp) builder.timestamp(input.timestamp);
		if (input.method) builder.method(input.method);
		if (input.image) builder.image(input.image);
		if (input.metadata) builder.metadata(input.metadata);
	}
	return builder;
}

export const signature: SignatureAPI = signatureImpl;
