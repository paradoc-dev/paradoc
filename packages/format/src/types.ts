import type {
	CaptureFormatKind,
	ContactFormatKind,
	FormatKind,
	NumericFormatKind,
	SelectionFormatKind,
	TemporalFormatKind,
} from '@paradoc/types'

/** The value families the formatter groups its kinds into. */
export type FormatFamily = 'numeric' | 'contact' | 'temporal' | 'capture' | 'selection'

type FamilyOf<K extends FormatKind> = K extends NumericFormatKind
	? 'numeric'
	: K extends ContactFormatKind
		? 'contact'
		: K extends TemporalFormatKind
			? 'temporal'
			: K extends CaptureFormatKind
				? 'capture'
				: K extends SelectionFormatKind
					? 'selection'
					: never

/**
 * The family of every format kind. A kind that `@paradoc/types` adds and this
 * table leaves out, or a kind filed under the wrong family, fails type-checking.
 */
export const FORMAT_KIND_FAMILIES = {
	money: 'numeric',
	address: 'contact',
	phone: 'contact',
	person: 'contact',
	organization: 'contact',
	party: 'contact',
	coordinate: 'capture',
	bbox: 'capture',
	duration: 'temporal',
	identification: 'capture',
	attachment: 'capture',
	signature: 'capture',
	date: 'temporal',
	datetime: 'temporal',
	time: 'temporal',
	number: 'numeric',
	percentage: 'numeric',
	boolean: 'selection',
	enum: 'selection',
	multiselect: 'selection',
	rating: 'selection',
} as const satisfies { readonly [K in FormatKind]: FamilyOf<K> }

/** Value families understood by the public formatter contract. */
export const FORMAT_KINDS: readonly FormatKind[] = Object.freeze(Object.keys(FORMAT_KIND_FAMILIES) as FormatKind[])

export function isFormatKind(kind: unknown): kind is FormatKind {
	return typeof kind === 'string' && Object.hasOwn(FORMAT_KIND_FAMILIES, kind)
}

export type * from '@paradoc/types'
