import type { Attachment } from '@paradoc/types';

export interface AttachmentBuilder {
	from(value: Attachment): AttachmentBuilder;
	name(value: string): AttachmentBuilder;
	mimeType(value: string): AttachmentBuilder;
	checksum(value: string): AttachmentBuilder;
	build(): Attachment;
}

function createBuilder(): AttachmentBuilder {
	const _data: Partial<Attachment> = {};

	const builder: AttachmentBuilder = {
		from(value) {
			Object.assign(_data, value);
			return builder;
		},
		name(value) {
			_data.name = value;
			return builder;
		},
		mimeType(value) {
			_data.mimeType = value;
			return builder;
		},
		checksum(value) {
			_data.checksum = value;
			return builder;
		},
		build() {
			if (!_data.name) {
				throw new Error('Attachment name is required');
			}
			if (!_data.mimeType) {
				throw new Error('Attachment mimeType is required');
			}
			return _data as Attachment;
		},
	};

	return builder;
}

type AttachmentAPI = {
	(): AttachmentBuilder;
	(input: Partial<Attachment>): AttachmentBuilder;
};

function attachmentImpl(): AttachmentBuilder;
function attachmentImpl(input: Partial<Attachment>): AttachmentBuilder;
function attachmentImpl(input?: Partial<Attachment>): AttachmentBuilder {
	const builder = createBuilder();
	if (input) {
		if (input.name) builder.name(input.name);
		if (input.mimeType) builder.mimeType(input.mimeType);
		if (input.checksum) builder.checksum(input.checksum);
	}
	return builder;
}

export const attachment: AttachmentAPI = attachmentImpl;
