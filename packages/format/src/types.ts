import type { FormatKind } from '@paradoc/types'

/** Value families understood by the public formatter contract. */
export const FORMAT_KINDS = [
	'money',
	'address',
	'phone',
	'person',
	'organization',
	'party',
	'coordinate',
	'bbox',
	'duration',
	'identification',
	'attachment',
	'signature',
	'date',
	'datetime',
	'time',
	'number',
	'percentage',
] as const satisfies readonly FormatKind[]

export type * from '@paradoc/types'
