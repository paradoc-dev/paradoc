import { ISO_8601_DURATION_REGEX, isPdfMimeType, isReactLayerMimeType, type SchemaVersion } from '@paradoc/schemas'
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
 * 2026-09-22 to 2026-09-23.
 *
 * - Only PDF file layers take `bindings` and `bindingsFrom`: a binding maps an
 *   AcroForm field name to a Paradoc path. A text, Markdown, HTML or DOCX
 *   template names each value as `{{fields.x}}` instead. The step cannot
 *   rewrite a template that used a binding alias, so it names the binding.
 */
const bindingsOnlyOnPdfLayers: MigrationStep = {
	from: '2026-09-22',
	to: '2026-09-23',
	summary: 'Allows bindings and bindingsFrom only on PDF file layers; names any other layer that declares them.',
	apply(artifact) {
		eachArtifact(artifact, [], (current, path) => {
			eachLayer(current, path, (layer, layerPath) => {
				if (layer.kind === 'file' && typeof layer.mimeType === 'string' && isPdfMimeType(layer.mimeType)) return
				for (const key of ['bindings', 'bindingsFrom'] as const) {
					if (layer[key] === undefined) continue
					throw new UnconvertibleValueError(
						[...layerPath, key],
						layer[key],
						'only PDF file layers take bindings; name each value in the template as {{fields.fieldName}} and remove the binding',
					)
				}
			})
		})
		return artifact
	},
}

/** The block keys the 2026-09-24 step moves into `signatures`. */
const SIGNATURE_BLOCK_KEYS = ['signatureBlocks', 'anchorBlocks'] as const

/**
 * Converts one legacy signature block into a signature slot. A block with no
 * party role placed nothing when sealed, and a slot must name a party, so
 * the block is named instead of dropped.
 */
function blockToSlot(block: unknown, key: (typeof SIGNATURE_BLOCK_KEYS)[number], path: Path): Record<string, unknown> {
	if (!isObject(block) || typeof block.partyRole !== 'string') {
		throw new UnconvertibleValueError(
			path,
			block,
			'a signature block without a partyRole places no signature; give it a partyRole or remove it',
		)
	}
	const placement =
		key === 'signatureBlocks'
			? { page: block.page, x: block.x, y: block.y, width: block.width, height: block.height }
			: { anchor: block.anchor, width: block.width, height: block.height }
	return {
		party: { role: block.partyRole, ...(block.partyIndex !== undefined && { index: block.partyIndex }) },
		type: block.type === 'date' ? 'date_signed' : block.type,
		...(block.required !== undefined && { required: block.required }),
		...(block.label !== undefined && { label: block.label }),
		placement,
	}
}

/**
 * 2026-09-23 to 2026-09-24.
 *
 * - A layer's `signatureBlocks` and `anchorBlocks` are removed. Each block
 *   moves into `signatures` under the same id: `partyRole` and `partyIndex`
 *   become `party`, the block type `date` becomes `date_signed`, and the
 *   coordinates or anchor become the slot's `placement`. A block with no
 *   party role, or an id that another slot already uses, is named.
 */
const signatureBlocksToSlots: MigrationStep = {
	from: '2026-09-23',
	to: '2026-09-24',
	summary: 'Moves layer signatureBlocks and anchorBlocks into signatures.',
	apply(artifact) {
		eachArtifact(artifact, [], (current, path) => {
			eachLayer(current, path, (layer, layerPath) => {
				if (SIGNATURE_BLOCK_KEYS.every((key) => layer[key] === undefined)) return
				if (layer.signatures !== undefined && !isObject(layer.signatures)) {
					throw new UnconvertibleValueError([...layerPath, 'signatures'], layer.signatures, 'signatures must be a map of slots keyed by id')
				}
				const slots: Record<string, unknown> = { ...layer.signatures }
				for (const key of SIGNATURE_BLOCK_KEYS) {
					const blocks = layer[key]
					if (blocks === undefined) continue
					if (!isObject(blocks)) {
						throw new UnconvertibleValueError([...layerPath, key], blocks, `${key} must be a map of blocks keyed by id`)
					}
					for (const [id, block] of Object.entries(blocks)) {
						const blockPath = [...layerPath, key, id]
						if (Object.hasOwn(slots, id)) {
							throw new UnconvertibleValueError(
								blockPath,
								block,
								`the slot id "${id}" is already used by another slot on this layer; rename one of them`,
							)
						}
						slots[id] = blockToSlot(block, key, blockPath)
					}
					delete layer[key]
				}
				if (Object.keys(slots).length > 0) layer.signatures = slots
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
	bindingsOnlyOnPdfLayers,
	signatureBlocksToSlots,
]
