/**
 * Canonical runtime shapes for composite field primitives.
 *
 * The TS types in `form-payload.ts` describe these shapes for type
 * inference. This file promotes the same shapes to runtime data so the
 * form-completion agent can look up the contract for `address`,
 * `phone`, `money`, etc. without relying on training-data recall.
 *
 * Single source of truth pattern: when adding a new composite primitive,
 * update both this map AND the corresponding `F extends { type: '...' }`
 * branch in form-payload.ts.
 */

export type CompositePropertySpec = {
	name: string
	jsType: 'string' | 'number'
	description?: string
}

export type CompositeShape = {
	type: string
	description: string
	required: CompositePropertySpec[]
	optional: CompositePropertySpec[]
}

export const CANONICAL_SHAPES: Record<string, CompositeShape> = {
	address: {
		type: 'address',
		description:
			'Postal address. line1 is the primary street address; line2 is unit/apt/suite (optional). locality is the city/town. region is the state or province (ISO subdivision code or local equivalent). country is an ISO 3166-1 alpha-2 code.',
		required: [
			{ name: 'line1', jsType: 'string' },
			{ name: 'locality', jsType: 'string', description: 'City or town' },
			{ name: 'region', jsType: 'string', description: 'State / province / subdivision' },
			{ name: 'postalCode', jsType: 'string' },
			{ name: 'country', jsType: 'string', description: 'ISO 3166-1 alpha-2 (e.g. "US")' },
		],
		optional: [
			{ name: 'line2', jsType: 'string', description: 'Apt, suite, or unit' },
		],
	},
	phone: {
		type: 'phone',
		description:
			'Telephone number in E.164 international format. `number` MUST start with `+` followed by the country code and the national number (e.g. `+12154852665`, `+442012345678`). If the user gives a domestic-format number without country code, prepend the country dialing code that fits the form\'s context (default `+1` for US/Canada forms when no other context is given). Strip spaces, dashes, parentheses.',
		required: [{ name: 'number', jsType: 'string', description: 'E.164 (e.g. "+12154852665")' }],
		optional: [
			{ name: 'type', jsType: 'string', description: 'mobile | home | office | fax | etc.' },
			{ name: 'extension', jsType: 'string' },
		],
	},
	money: {
		type: 'money',
		description:
			'Monetary amount. amount is a number (decimal, not a string; e.g. 100.50 not "100.50"). currency is an ISO 4217 code (e.g. "USD", "EUR").',
		required: [
			{ name: 'amount', jsType: 'number' },
			{ name: 'currency', jsType: 'string', description: 'ISO 4217 code' },
		],
		optional: [],
	},
	person: {
		type: 'person',
		description:
			'Person identity. Always provide `name` (the full display name). The split-name fields are optional refinements; if you have them, include them — otherwise just `name` is sufficient.',
		required: [
			{ name: 'name', jsType: 'string', description: 'Full display name' },
		],
		optional: [
			{ name: 'title', jsType: 'string', description: 'Mr / Ms / Dr / etc.' },
			{ name: 'firstName', jsType: 'string' },
			{ name: 'middleName', jsType: 'string' },
			{ name: 'lastName', jsType: 'string' },
			{ name: 'suffix', jsType: 'string', description: 'Jr / Sr / III / etc.' },
		],
	},
	organization: {
		type: 'organization',
		description:
			'Organization identity. `name` is the common operating name. The remaining fields are optional refinements for jurisdictions, registrations, or tax identification.',
		required: [{ name: 'name', jsType: 'string' }],
		optional: [
			{ name: 'legalName', jsType: 'string' },
			{ name: 'domicile', jsType: 'string', description: 'State/country of incorporation' },
			{ name: 'entityType', jsType: 'string', description: 'LLC / Corp / Partnership / etc.' },
			{ name: 'entityId', jsType: 'string' },
			{ name: 'taxId', jsType: 'string', description: 'EIN / VAT / equivalent' },
		],
	},
	coordinate: {
		type: 'coordinate',
		description: 'Geographic point. lat/lon in decimal degrees.',
		required: [
			{ name: 'lat', jsType: 'number' },
			{ name: 'lon', jsType: 'number' },
		],
		optional: [],
	},
	identification: {
		type: 'identification',
		description:
			'Identity document. `type` is the document category (e.g. "driver_license", "passport"). `number` is the document number. The remaining fields are optional refinements.',
		required: [
			{ name: 'type', jsType: 'string' },
			{ name: 'number', jsType: 'string' },
		],
		optional: [
			{ name: 'issuer', jsType: 'string', description: 'Issuing authority (e.g. state, country)' },
			{ name: 'issueDate', jsType: 'string', description: 'ISO 8601 date (YYYY-MM-DD)' },
			{ name: 'expiryDate', jsType: 'string', description: 'ISO 8601 date (YYYY-MM-DD)' },
		],
	},
}

/**
 * Convenience predicate — true when the given field type has a known
 * composite shape (i.e. expects an object, not a scalar).
 */
export function isCompositeType(type: string | undefined): boolean {
	if (!type) return false
	return type in CANONICAL_SHAPES
}

/**
 * Render the composite shape as a compact one-line JSON-ish summary
 * suitable for inlining in a system prompt or tool response. Required
 * fields are shown without `?`; optional fields are shown with `?`.
 *
 * Example output:
 *   address: { line1: string, line2?: string, locality: string, region: string, postalCode: string, country: string }
 */
export function describeCompositeShape(type: string): string | null {
	const shape = CANONICAL_SHAPES[type]
	if (!shape) return null
	const slots: string[] = []
	for (const p of shape.required) slots.push(`${p.name}: ${p.jsType}`)
	for (const p of shape.optional) slots.push(`${p.name}?: ${p.jsType}`)
	return `${shape.type}: { ${slots.join(', ')} }`
}
