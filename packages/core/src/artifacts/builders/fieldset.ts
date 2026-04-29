/**
 * Closure-based fieldset builder for artifacts.
 *
 * Uses factory function and object literal instead of class.
 */

import type { FormField, FormFieldset } from '@paradoc/types';
import { parseFormFieldset, parseFormField } from '@/validation/artifact-parsers';

// ============================================================================
// Validation
// ============================================================================

function parseFieldset(input: unknown): FormFieldset {
	return parseFormFieldset(input);
}

function parseField(input: unknown): FormField {
	return parseFormField(input);
}

// ============================================================================
// Builder Type
// ============================================================================

export interface FieldsetBuilder {
	/** Initialize from existing FormFieldset */
	from(value: FormFieldset): FieldsetBuilder;
	/** Set the title for this fieldset */
	title(value: string | undefined): FieldsetBuilder;
	/** Set an optional description for this fieldset */
	description(value: string | undefined): FieldsetBuilder;
	/** Add a single field to the fieldset */
	field(id: string, fieldDef: FormField): FieldsetBuilder;
	/** Add multiple fields to the fieldset */
	fields(fieldsObj: Record<string, FormField>): FieldsetBuilder;
	/** Set whether the fieldset is required */
	required(value?: boolean): FieldsetBuilder;
	/** Set the display order */
	order(value: number | undefined): FieldsetBuilder;
	/** Build the FormFieldset definition */
	build(): FormFieldset;
}

// ============================================================================
// Factory Function
// ============================================================================

export function fieldsetBuilder(): FieldsetBuilder {
	const _def: Record<string, unknown> = { fields: {} };

	const self: FieldsetBuilder = {
		from(value: FormFieldset) {
			Object.assign(_def, parseFieldset(value));
			return self;
		},
		title(value: string | undefined) {
			_def.title = value;
			return self;
		},
		description(value: string | undefined) {
			_def.description = value;
			return self;
		},
		field(fieldId: string, fieldDef: FormField) {
			const fields = (_def.fields as Record<string, FormField>) || {};
			fields[fieldId] = parseField(fieldDef);
			_def.fields = fields;
			return self;
		},
		fields(fieldsObj: Record<string, FormField>) {
			const fields = (_def.fields as Record<string, FormField>) || {};
			for (const [fieldId, fieldDef] of Object.entries(fieldsObj)) {
				fields[fieldId] = parseField(fieldDef);
			}
			_def.fields = fields;
			return self;
		},
		required(value = true) {
			_def.required = value;
			return self;
		},
		order(value: number | undefined) {
			_def.order = value;
			return self;
		},
		build() {
			return parseFieldset(_def);
		},
	};

	return self;
}

// ============================================================================
// Fieldset API
// ============================================================================

export type FieldsetAPI = {
	(): FieldsetBuilder;
	(fieldsObj: Record<string, FormField>): FieldsetBuilder;
	(input: FormFieldset): FormFieldset;
	parse(input: unknown): FormFieldset;
	safeParse(input: unknown): { success: true; data: FormFieldset } | { success: false; error: Error };
};

function fieldsetImpl(): FieldsetBuilder;
function fieldsetImpl(fieldsObj: Record<string, FormField>): FieldsetBuilder;
function fieldsetImpl(input: FormFieldset): FormFieldset;
function fieldsetImpl(input?: Record<string, FormField> | FormFieldset): FieldsetBuilder | FormFieldset {
	if (input === undefined) {
		return fieldsetBuilder();
	}
	if (typeof input === 'object' && input !== null && !('fields' in input)) {
		// It's a fields object, create a builder and set fields
		const builder = fieldsetBuilder();
		return builder.fields(input as Record<string, FormField>);
	}
	return parseFieldset(input);
}

/**
 * Fieldset builder for grouping related fields.
 *
 * @example
 * ```ts
 * const addressFieldset = fieldset()
 *   .title('Address')
 *   .fields({
 *     street: { type: 'text', label: 'Street' },
 *     city: { type: 'text', label: 'City' },
 *   })
 *   .build()
 * ```
 */
export const fieldset: FieldsetAPI = Object.assign(fieldsetImpl, {
	parse: parseFieldset,
	safeParse: (input: unknown): { success: true; data: FormFieldset } | { success: false; error: Error } => {
		try {
			return { success: true, data: parseFieldset(input) };
		} catch (err) {
			return { success: false, error: err as Error };
		}
	},
});
