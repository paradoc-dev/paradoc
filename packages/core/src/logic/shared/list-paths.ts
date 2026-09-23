/**
 * How reference paths meet list fields.
 *
 * An aggregate reads a path such as `fields.items.parts.cost` across every row
 * of every list it passes through, skipping hidden rows. Three consumers need
 * that walk: runtime row visibility (is row `[2, 0]` of `fields.items.parts`
 * shown?), definition ordering (an aggregate depends on the conditions that
 * hide its rows), and the fill-state graph (a list's rows are not graph nodes,
 * so a path into them depends on the list field itself).
 */

import type { CondExpr, FormField } from '@paradoc/types'
import { parseExpression } from '../design-time/validation/expression-parser'

type Fields = Record<string, FormField> | undefined

/** The field-id segments of a path: `fields.` stripped, or a rule's direct field path. */
function fieldSegments(path: string, fields: Fields): string[] | undefined {
	const segments = path.split('.')
	if (segments[0] === 'fields') return segments.slice(1)
	return fields && Object.prototype.hasOwnProperty.call(fields, segments[0]!) ? segments : undefined
}

/** The fields a member of `field` is looked up in: its children, or its list item's. */
function childFields(field: FormField): Fields {
	if (field.type === 'fieldset') return field.fields
	if (field.type === 'list') return childFields(field.item)
	return undefined
}

/** Where a row sits: its list's `fields.` path and its position at every list level. */
export interface RowOrigin {
	readonly listPath: string
	readonly indices: readonly number[]
}

/** One bound row: its value and where it sits. */
export interface RowFrame {
	readonly value: unknown
	readonly origin: RowOrigin
}

/** The rows a list-item condition sees: `item`, and `parent` in a nested list. */
export interface RowFrames {
	readonly item: RowFrame
	readonly parent?: RowFrame
}

/** The origin of row `index` of the list whose runtime id is `listId` (`items[2].parts`). */
export function rowOriginOf(listId: string, index: number): RowOrigin {
	const indices: number[] = []
	const path = listId.replace(/\[(\d+)\]/g, (_, n: string) => {
		indices.push(Number(n))
		return ''
	})
	return { listPath: `fields.${path}`, indices: [...indices, index] }
}

/**
 * Rewrite a list path rooted at a row reference (`item.parts`) to the list
 * it names (`fields.items.parts`), prefixing the row's own position.
 */
export function resolveRowListPath(
	listPath: string,
	indices: readonly number[],
	frames: { readonly item?: RowOrigin; readonly parent?: RowOrigin } | undefined,
): { listPath: string; indices: readonly number[] } {
	const [root, ...rest] = listPath.split('.')
	const origin = root === 'item' ? frames?.item : root === 'parent' ? frames?.parent : undefined
	if (!origin) return { listPath, indices }
	return { listPath: [origin.listPath, ...rest].join('.'), indices: [...origin.indices, ...indices] }
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Whether one row of a list is shown: the list and every field above it are
 * visible, and so is the item at each list level. Each condition is evaluated
 * with the rows that enclose it bound as `item` and `parent`, as the form
 * evaluator binds them. `context` holds the data: `fields` for a `fields.`
 * path, or the fields themselves for a rule's direct path.
 */
export function isRowVisible(
	fields: Fields,
	listPath: string,
	indices: readonly number[],
	context: Record<string, unknown>,
	evaluate: (condition: CondExpr | undefined, rows: RowFrames | undefined) => boolean,
): boolean {
	const segments = fieldSegments(listPath, fields)
	if (!segments) return true
	const prefixed = listPath.startsWith('fields.')
	let scope = fields
	let value: unknown = prefixed ? context.fields : context
	let rows: RowFrames | undefined
	let path = 'fields'
	let level = 0
	for (const segment of segments) {
		const field = scope?.[segment]
		if (!field) return true
		if (!evaluate(field.visible, rows)) return false
		path = `${path}.${segment}`
		let fieldValue = isRecord(value) ? value[segment] : undefined
		if (field.type === 'list') {
			if (level >= indices.length) return true
			const position = indices.slice(0, ++level)
			const row = Array.isArray(fieldValue) ? fieldValue[position[position.length - 1]!] : undefined
			rows = { item: { value: row, origin: { listPath: path, indices: position } }, ...(rows && { parent: rows.item }) }
			if (!evaluate(field.item.visible, rows)) return false
			fieldValue = row
		}
		scope = childFields(field)
		value = fieldValue
	}
	return true
}

/**
 * The `visible` conditions that decide which rows a path reads: those of every
 * field down to the deepest list it passes through, and of each list's item.
 * A path through no list reads no rows and returns none.
 */
export function rowConditionsOf(fields: Fields, path: string): string[] {
	const segments = fieldSegments(path, fields)
	if (!segments) return []
	const conditions: string[] = []
	let throughList: string[] = []
	let scope = fields
	for (const segment of segments) {
		const field = scope?.[segment]
		if (!field) break
		if (typeof field.visible === 'string') conditions.push(field.visible)
		if (field.type === 'list') {
			if (typeof field.item.visible === 'string') conditions.push(field.item.visible)
			throughList = [...conditions]
		}
		scope = childFields(field)
	}
	return throughList
}

/** The row conditions of every list path an expression reads, for dependency ordering. */
export function rowConditionsOfExpression(fields: Fields, expression: string): string[] {
	const parsed = parseExpression(expression)
	if (!parsed.success) return []
	return parsed.variables.flatMap((variable) => rowConditionsOf(fields, variable))
}

/**
 * The fill-state node a field id belongs to. List rows are not graph nodes, so
 * an id inside a list's item (`items.amount`) resolves to the list (`items`);
 * every other id is returned unchanged.
 */
export function fillNodeOf(fields: Fields, id: string): string {
	const segments = id.split('.')
	let scope = fields
	for (let i = 0; i < segments.length; i++) {
		const field = scope?.[segments[i]!]
		if (!field) return id
		if (field.type === 'list') return segments.slice(0, i + 1).join('.')
		scope = field.type === 'fieldset' ? field.fields : undefined
	}
	return id
}
