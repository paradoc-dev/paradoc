/**
 * Composite value shapes: the object-valued field types and their members.
 *
 * Each shape is the `@paradoc/schemas` primitive of the same name. Everything
 * else that states a composite shape derives from `COMPOSITE_VALUE_SCHEMAS`:
 * the compiled data schema (`compile`), the expression member tables
 * (`COMPLEX_TYPE_PROPERTIES`), and `CANONICAL_SHAPES`, which the
 * form-completion agent reads. `FieldToDataType` uses the matching
 * `@paradoc/types` interfaces, which the schemas package proves equal to these
 * schemas.
 */

import { z } from 'zod'
import {
	AddressSchema,
	BboxSchema,
	CoordinateSchema,
	IdentificationSchema,
	MoneySchema,
	OrganizationSchema,
	PersonSchema,
	PhoneSchema,
} from '@paradoc/schemas'
import { deepClone } from '@/utils/clone'
import type { JsonSchema } from './form-payload'

/** The `@paradoc/schemas` primitive behind each composite field type. */
export const COMPOSITE_VALUE_SCHEMAS = {
	money: MoneySchema,
	address: AddressSchema,
	phone: PhoneSchema,
	coordinate: CoordinateSchema,
	bbox: BboxSchema,
	person: PersonSchema,
	organization: OrganizationSchema,
	identification: IdentificationSchema,
} as const

/** A field type whose value is a composite object. */
export type CompositeValueType = keyof typeof COMPOSITE_VALUE_SCHEMAS

/** Replaces each local `$ref` with the definition it names. */
function inlineRefs(node: unknown, defs: Record<string, JsonSchema>): unknown {
	if (Array.isArray(node)) return node.map((item) => inlineRefs(item, defs))
	if (node === null || typeof node !== 'object') return node
	const { $ref, $defs: _defs, $schema: _schema, ...rest } = node as JsonSchema
	const resolved: Record<string, unknown> = {}
	if (typeof $ref === 'string') {
		const name = $ref.replace('#/$defs/', '')
		const target = defs[name]
		if (!target) throw new Error(`Unresolved $ref ${$ref} in a composite value schema`)
		Object.assign(resolved, inlineRefs(target, defs))
	}
	for (const [key, value] of Object.entries(rest)) resolved[key] = inlineRefs(value, defs)
	// Zod states a string format twice, as `format` and as a `pattern`; the
	// format alone is the contract a validator checks.
	if (typeof resolved.format === 'string') delete resolved.pattern
	return resolved
}

function toJsonSchema(schema: z.ZodType): JsonSchema {
	const generated = z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'input' }) as JsonSchema
	return inlineRefs(generated, (generated.$defs ?? {}) as Record<string, JsonSchema>) as JsonSchema
}

const COMPOSITE_JSON_SCHEMAS = Object.fromEntries(
	Object.entries(COMPOSITE_VALUE_SCHEMAS).map(([type, schema]) => [type, toJsonSchema(schema)]),
) as Record<CompositeValueType, JsonSchema>

/** True when the field type's value is a composite object. */
export function isCompositeType(type: string | undefined): type is CompositeValueType {
	return type !== undefined && Object.prototype.hasOwnProperty.call(COMPOSITE_VALUE_SCHEMAS, type)
}

/**
 * The JSON Schema of a composite value, generated from its `@paradoc/schemas`
 * primitive. Each call returns a fresh copy the caller may extend.
 */
export function compositeJsonSchema(type: CompositeValueType): JsonSchema {
	return deepClone(COMPOSITE_JSON_SCHEMAS[type])
}

// ============================================================================
// Canonical shapes for the form-completion agent
// ============================================================================

export type CompositePropertySpec = {
	name: string
	jsType: 'string' | 'number' | 'object'
	description?: string
	/** Members of an object-valued property, such as a bbox corner. */
	required?: CompositePropertySpec[]
	optional?: CompositePropertySpec[]
}

export type CompositeShape = {
	type: CompositeValueType
	description: string
	required: CompositePropertySpec[]
	optional: CompositePropertySpec[]
}

/**
 * How an agent fills each shape. This is guidance only: the member names,
 * which members are required, and their types come from the schema.
 */
const SHAPE_GUIDANCE: Record<CompositeValueType, string> = {
	money:
		'Monetary amount. `amount` is a number (decimal, not a string: 100.50, not "100.50"). `currency` is an ISO 4217 code in capitals (e.g. "USD", "EUR").',
	address:
		'Postal address. `line1` is the street address; `line2` is the unit, apartment, or suite. `locality` is the city or town (not `city`). `region` is the state or province. `postalCode` uses capital letters, digits, spaces, and hyphens. `country` is an ISO 3166-1 code (e.g. "US", "FRA") or the full country name.',
	phone:
		'Telephone number. `number` MUST be E.164: a leading `+`, the country dialing code, then the national number (e.g. "+12154852665"). If the user gives a domestic number without a country code, prepend the dialing code that fits the form\'s context (default +1 for US and Canada forms). Strip spaces, dashes, and parentheses. `type` is the kind of number (e.g. "mobile", "fax").',
	coordinate: 'Geographic point. `lat` and `lon` are numbers in decimal degrees.',
	bbox: 'Geographic bounding box: the `southWest` and `northEast` corners, each `{ lat, lon }` in decimal degrees.',
	person:
		'Person. Always give `name`, the full display name. The split-name members are optional; include them only when the user gave them.',
	organization:
		'Organization. Always give `name`, the common operating name. The other members are optional registration and tax details.',
	identification:
		'Identity document. `type` is the document category (e.g. "driver_license", "passport"). `number` is the document number. Dates are ISO 8601 (YYYY-MM-DD).',
}

function jsTypeOf(schema: JsonSchema): CompositePropertySpec['jsType'] {
	if (schema.type === 'number' || schema.type === 'integer') return 'number'
	if (schema.type === 'object') return 'object'
	return 'string'
}

function memberSpecs(schema: JsonSchema): Pick<CompositeShape, 'required' | 'optional'> {
	const required: CompositePropertySpec[] = []
	const optional: CompositePropertySpec[] = []
	const requiredNames = new Set(schema.required ?? [])
	for (const [name, member] of Object.entries(schema.properties ?? {})) {
		const jsType = jsTypeOf(member)
		const spec: CompositePropertySpec = {
			name,
			jsType,
			...(member.description !== undefined && { description: member.description }),
			...(jsType === 'object' && memberSpecs(member)),
		}
		;(requiredNames.has(name) ? required : optional).push(spec)
	}
	return { required, optional }
}

/**
 * The runtime shape of each composite field type, for an agent that must
 * build the value without recalling it from training data.
 */
export const CANONICAL_SHAPES = Object.fromEntries(
	(Object.keys(COMPOSITE_VALUE_SCHEMAS) as CompositeValueType[]).map((type) => [
		type,
		{ type, description: SHAPE_GUIDANCE[type], ...memberSpecs(COMPOSITE_JSON_SCHEMAS[type]) },
	]),
) as Record<CompositeValueType, CompositeShape>

function describeMembers(members: Pick<CompositeShape, 'required' | 'optional'>): string {
	const slot = (p: CompositePropertySpec, optional: boolean): string => {
		const type = p.jsType === 'object' ? describeMembers({ required: p.required ?? [], optional: p.optional ?? [] }) : p.jsType
		return `${p.name}${optional ? '?' : ''}: ${type}`
	}
	return `{ ${[...members.required.map((p) => slot(p, false)), ...members.optional.map((p) => slot(p, true))].join(', ')} }`
}

/**
 * Render the composite shape as a compact one-line summary suitable for
 * inlining in a system prompt or tool response. Required members are shown
 * without `?`; optional members with `?`.
 *
 * Example output:
 *   address: { line1: string, locality: string, region: string, postalCode: string, country: string, line2?: string }
 */
export function describeCompositeShape(type: string): string | null {
	if (!isCompositeType(type)) return null
	return `${type}: ${describeMembers(CANONICAL_SHAPES[type])}`
}
