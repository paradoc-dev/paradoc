import { ISO_8601_DURATION_REGEX, isReactLayerMimeType, type SchemaVersion } from '@paradoc/schemas'
import { UnconvertibleValueError } from './errors'

/** A parsed artifact as a plain JSON object. */
export type ArtifactObject = Record<string, unknown>

type Path = readonly (string | number)[]

/**
 * Converts an artifact from one schema version to the next.
 *
 * `apply` receives a private copy it may change and returns the converted
 * artifact. When it meets a value it cannot convert safely it throws
 * `UnconvertibleValueError` naming the value, and the migration changes nothing.
 */
export interface MigrationStep {
	readonly from: SchemaVersion
	readonly to: SchemaVersion
	/** What the step changes, in one sentence. */
	readonly summary: string
	apply(artifact: ArtifactObject): ArtifactObject
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Visit an artifact and every inline artifact nested in its bundle contents. */
function eachArtifact(artifact: ArtifactObject, path: Path, visit: (artifact: ArtifactObject, path: Path) => void): void {
	visit(artifact, path)
	const contents = artifact.contents
	if (artifact.kind !== 'bundle' || !Array.isArray(contents)) return
	contents.forEach((item, index) => {
		if (isObject(item) && item.type === 'inline' && isObject(item.artifact)) {
			eachArtifact(item.artifact, [...path, 'contents', index, 'artifact'], visit)
		}
	})
}

/** Visit every form field, including fields nested in fieldsets and list items. */
function eachField(fields: unknown, path: Path, visit: (field: Record<string, unknown>, path: Path) => void): void {
	if (!isObject(fields)) return
	for (const [name, field] of Object.entries(fields)) {
		if (!isObject(field)) continue
		const fieldPath = [...path, name]
		visitField(field, fieldPath, visit)
	}
}

function visitField(field: Record<string, unknown>, path: Path, visit: (field: Record<string, unknown>, path: Path) => void): void {
	visit(field, path)
	if (field.type === 'fieldset') eachField(field.fields, [...path, 'fields'], visit)
	if (field.type === 'list' && isObject(field.item)) visitField(field.item, [...path, 'item'], visit)
}

/** Visit every layer an artifact declares. */
function eachLayer(artifact: ArtifactObject, path: Path, visit: (layer: Record<string, unknown>, path: Path) => void): void {
	if (!isObject(artifact.layers)) return
	for (const [key, layer] of Object.entries(artifact.layers)) {
		if (isObject(layer)) visit(layer, [...path, 'layers', key])
	}
}

/** The flat bbox definition keys and the corner member each one moves to. */
const FLAT_BBOX_KEYS = {
	north: ['northEast', 'lat'],
	east: ['northEast', 'lon'],
	south: ['southWest', 'lat'],
	west: ['southWest', 'lon'],
} as const

/**
 * Moves a bbox definition value from flat north/south/east/west expressions to
 * the southWest/northEast corner shape that bbox fields use.
 */
function convertBboxDefinition(definition: Record<string, unknown>, path: Path): void {
	const value = definition.value
	if (!isObject(value) || !Object.keys(FLAT_BBOX_KEYS).some((key) => key in value)) return
	const corners: Record<'southWest' | 'northEast', Record<string, unknown>> = { southWest: {}, northEast: {} }
	for (const [key, member] of Object.entries(value)) {
		const target = FLAT_BBOX_KEYS[key as keyof typeof FLAT_BBOX_KEYS]
		if (!target) {
			throw new UnconvertibleValueError(
				[...path, 'value', key],
				member,
				'a bbox definition with north, south, east and west members cannot also carry other members',
			)
		}
		corners[target[0]][target[1]] = member
	}
	definition.value = corners
}

/**
 * 2026-08-10 to 2026-09-22.
 *
 * - The marker-based signature placement `'auto'` is renamed `'flow'`.
 * - An inline layer can no longer carry a React composition (`text/tsx` or
 *   `text/jsx`); a composition lives in a module file, so the step cannot
 *   move one and names it instead.
 * - A duration must contain a date or time component; `P` or `PT` alone has
 *   no meaning to carry forward, so a default like that is named.
 * - Field and party definitions reject unknown keys. A party's `multiple`
 *   never had an effect (`min` and `max` say how many parties a role takes),
 *   so it is dropped; any other unknown key fails validation by name.
 * - A bbox definition moves from flat north/south/east/west expressions to
 *   the southWest/northEast corners that bbox fields use.
 */
const flowPlacementAndStrictDefinitions: MigrationStep = {
	from: '2026-08-10',
	to: '2026-09-22',
	summary:
		"Renames signature placement 'auto' to 'flow'; rejects inline React layers and empty durations; drops party 'multiple'; moves bbox definitions to corners.",
	apply(artifact) {
		eachArtifact(artifact, [], (current, path) => {
			if (isObject(current.parties)) {
				for (const party of Object.values(current.parties)) {
					if (isObject(party)) delete party.multiple
				}
			}
			if (isObject(current.defs)) {
				for (const [key, definition] of Object.entries(current.defs)) {
					if (isObject(definition) && definition.type === 'bbox') convertBboxDefinition(definition, [...path, 'defs', key])
				}
			}
			eachLayer(current, path, (layer, layerPath) => {
				if (layer.kind === 'inline' && typeof layer.mimeType === 'string' && isReactLayerMimeType(layer.mimeType)) {
					throw new UnconvertibleValueError(
						[...layerPath, 'mimeType'],
						layer.mimeType,
						'an inline layer cannot hold a React composition; move it to a .tsx or .jsx file and declare a file layer',
					)
				}
				if (!isObject(layer.signatures)) return
				for (const slot of Object.values(layer.signatures)) {
					if (isObject(slot) && slot.placement === 'auto') slot.placement = 'flow'
				}
			})
			eachField(current.fields, [...path, 'fields'], (field, fieldPath) => {
				if (field.type !== 'duration' || field.default === undefined) return
				if (typeof field.default === 'string' && ISO_8601_DURATION_REGEX.test(field.default)) return
				throw new UnconvertibleValueError(
					[...fieldPath, 'default'],
					field.default,
					'a duration must contain at least one date or time component, such as P1D or PT30M',
				)
			})
		})
		return artifact
	},
}

/**
 * Every migration step, in version order. Each step leads from one published
 * version to the next, so a chain exists from every version to the current one.
 *
 * 2026-01-01, 2026-08-06, and 2026-08-10 were dated at releases, before a new
 * version required a breaking change; every artifact valid for one is valid
 * for the next, so their steps change nothing but the version.
 */
export const MIGRATION_STEPS: readonly MigrationStep[] = [
	{
		from: '2026-01-01',
		to: '2026-08-06',
		summary: 'No breaking change: adds list fields.',
		apply: (artifact) => artifact,
	},
	{
		from: '2026-08-06',
		to: '2026-08-10',
		summary: 'No breaking change: adds the layer signatures slot map.',
		apply: (artifact) => artifact,
	},
	flowPlacementAndStrictDefinitions,
]
