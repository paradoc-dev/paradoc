/**
 * Member paths of each composite value type, and each member's @paradoc/expr
 * type, derived from the composite value schemas. Field paths, row scopes,
 * definition members, and party members all read this one table.
 *
 * A nested member is keyed by its dotted path, such as `southWest.lat`. A
 * scalar-valued type, such as `duration` (an ISO 8601 string), has no members.
 */

import { T, type ExprType } from '@paradoc/expr'
import {
	COMPOSITE_VALUE_SCHEMAS,
	compositeJsonSchema,
	type CompositeValueType,
} from '../../inference/composite-shapes'
import type { JsonSchema } from '../../inference/form-payload'

function memberType(schema: JsonSchema): ExprType {
	if (schema.type === 'number' || schema.type === 'integer') return T.number
	if (schema.type === 'object') return T.object
	if (schema.type === 'string' && schema.format === 'date') return T.date
	return T.string
}

function collectMembers(schema: JsonSchema, prefix: string, acc: Record<string, ExprType>): void {
	for (const [name, member] of Object.entries(schema.properties ?? {})) {
		const path = `${prefix}${name}`
		acc[path] = memberType(member)
		if (member.type === 'object') collectMembers(member, `${path}.`, acc)
	}
}

export const COMPLEX_TYPE_PROPERTIES: Readonly<Record<string, Readonly<Record<string, ExprType>>>> =
	Object.fromEntries(
		(Object.keys(COMPOSITE_VALUE_SCHEMAS) as CompositeValueType[]).map((type) => {
			const members: Record<string, ExprType> = {}
			collectMembers(compositeJsonSchema(type), '', members)
			return [type, members]
		}),
	)
