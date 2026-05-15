/**
 * Checklist Artifact - Closure-based implementation
 *
 * This replaces the class-based ChecklistInstance, DraftChecklist, and CompletedChecklist
 * with a single file using closures and composition.
 */

import type { Checklist, ChecklistItem, Layer, Metadata, RendererLayer, Form, ContentRef } from '@paradoc/types'
import type { DraftChecklistJSON, CompletedChecklistJSON } from '@paradoc/types'
import { parseChecklist, parseChecklistItem, parseLayer } from '@/validation/artifact-parsers'
import {
	validateChecklistItemInput,
	validateChecklistItemsPatch,
	type ChecklistItemInputValidationInput,
	type ProgressiveValidationResult,
} from '@/validation'
import { toYAML } from '@/serialization/serialization'
import { withArtifactMethods, type ArtifactMethods } from '../shared/artifact-methods'
import { layer as layerBuilder, type FileLayerBuilderType, type InlineLayerBuilderType } from '@/artifacts/builders/layer'
import { type Buildable, resolveBuildable } from '@/artifacts/shared/buildable'
import type { RuntimeChecklistRenderOptions } from '@/types'

// ============================================================================
// Type Inference for Checklist Payloads
// ============================================================================

/**
 * Maps a status spec to its runtime data type.
 */
export type ItemStatusToDataType<S> = S extends { kind: 'boolean' }
	? boolean
	: S extends { kind: 'enum'; options: infer O }
		? O extends readonly { value: infer V }[]
			? V
			: string
		: boolean

/**
 * Maps checklist items array to a record type of item IDs to their status data types.
 */
export type ItemsToDataType<Items> = Items extends readonly { id: infer Id; status?: infer S }[]
	? { [K in Id & string]: S extends object ? ItemStatusToDataType<S> : boolean }
	: Record<string, boolean | string>

/**
 * Infers the payload type for a checklist based on its item definitions.
 */
export type InferChecklistPayload<C> = C extends { items: infer I } ? ItemsToDataType<I> : Record<string, boolean | string>

// ============================================================================
// Types
// ============================================================================

/**
 * Checklist input type for direct creation (kind is optional)
 */
export type ChecklistInput = Omit<Checklist, 'kind'> & { kind?: 'checklist' }

/**
 * RuntimeChecklist JSON representation
 */
export type RuntimeChecklistJSON<C extends Checklist> = DraftChecklistJSON<C> | CompletedChecklistJSON<C>

/**
 * ChecklistInstance - design-time wrapper for Checklist artifacts
 */
export interface ChecklistInstance<C extends Checklist> extends ArtifactMethods<C> {
	/** Checklist items */
	readonly items: C extends { items: infer I } ? I : ChecklistItem[]

	/** Checklist layers */
	readonly layers: C extends { layers: infer L } ? L : Record<string, Layer> | undefined

	/** Default layer key */
	readonly defaultLayer: C extends { defaultLayer: infer DL } ? DL : string | undefined

	/**
	 * Create a RuntimeChecklist in draft phase with item status data.
	 * @param data - The item status payload
	 * @throws Error if data validation fails
	 */
	fill(data: InferChecklistPayload<C>): DraftChecklist<C>

	/**
	 * Validate one checklist item input by item ID.
	 */
	validateItemInput(input: ChecklistItemInputValidationInput): ProgressiveValidationResult<boolean | string>

	/**
	 * Validate a partial checklist items patch.
	 */
	validateItemsPatch(items: unknown): ProgressiveValidationResult<Record<string, boolean | string>>

	/**
	 * Safely create a RuntimeChecklist, returning a result object instead of throwing.
	 * @param data - The item status payload
	 */
	safeFill(data: InferChecklistPayload<C>): { success: true; data: DraftChecklist<C> } | { success: false; error: Error }

	/**
	 * Render checklist content.
	 * @param options - Render options including renderer, resolver and layer override
	 * @returns If renderer provided: processed output. Otherwise: raw layer content.
	 */
	render<Output = string | Uint8Array>(options?: RuntimeChecklistRenderOptions<Output>): Promise<Output>

	/**
	 * Create an exact copy of this instance.
	 */
	clone(): ChecklistInstance<C>
}

// ============================================================================
// Phase-Specific Interfaces (Discriminated Union)
// ============================================================================

/**
 * Base interface with shared read-only properties and methods (all phases)
 */
interface RuntimeChecklistBase<C extends Checklist> {
	/** Embedded checklist definition */
	readonly checklist: C

	/** Target layer key */
	readonly targetLayer: string

	// Convenience getters
	readonly name: string
	readonly version: string | undefined
	readonly title: string | undefined
	readonly items: C['items']
	readonly layers: C['layers']

	/**
	 * Get the status value of a specific item.
	 */
	getItem<K extends keyof InferChecklistPayload<C> & string>(itemId: K): InferChecklistPayload<C>[K]

	/**
	 * Get all item status values.
	 */
	getAllItems(): InferChecklistPayload<C>

	/**
	 * Check if the checklist data is valid.
	 * Always returns true since data is validated at construction.
	 */
	isValid(): true

	/**
	 * Render the checklist content.
	 * @param options - Render options including renderer, resolver and layer override
	 * @returns If renderer provided: processed output. Otherwise: raw layer content.
	 */
	render<Output = string | Uint8Array>(options?: RuntimeChecklistRenderOptions<Output>): Promise<Output>

	/**
	 * Serialize to JSON.
	 */
	toJSON(): RuntimeChecklistJSON<C>

	/**
	 * Serialize to YAML.
	 */
	toYAML(): string
}

/**
 * Draft phase - can modify items and complete
 */
export interface DraftChecklist<C extends Checklist> extends RuntimeChecklistBase<C> {
	/** Phase discriminator */
	readonly phase: 'draft'

	/** Completion timestamp (always undefined for draft) */
	readonly completedAt: undefined

	/**
	 * Create a new RuntimeChecklist with a single item updated.
	 */
	setItem<K extends keyof InferChecklistPayload<C> & string>(
		itemId: K,
		value: InferChecklistPayload<C>[K],
	): DraftChecklist<C>

	/**
	 * Create a new RuntimeChecklist with multiple items updated.
	 */
	updateItems(updates: Partial<InferChecklistPayload<C>>): DraftChecklist<C>

	/**
	 * Change target layer.
	 */
	setTargetLayer<K extends keyof C['layers'] & string>(layer: K): DraftChecklist<C>

	/**
	 * Complete the checklist (draft → completed).
	 */
	complete(): CompletedChecklist<C>

	/**
	 * Create an exact copy.
	 */
	clone(): DraftChecklist<C>
}

/**
 * Completed phase - immutable, read-only
 */
export interface CompletedChecklist<C extends Checklist> extends RuntimeChecklistBase<C> {
	/** Phase discriminator */
	readonly phase: 'completed'

	/** Completion timestamp (always defined for completed) */
	readonly completedAt: string

	/**
	 * Create an exact copy.
	 */
	clone(): CompletedChecklist<C>
}

/**
 * RuntimeChecklist - discriminated union of all phases
 */
export type RuntimeChecklist<C extends Checklist> = DraftChecklist<C> | CompletedChecklist<C>

// ============================================================================
// Item Validation Helper
// ============================================================================

function validateItemValue(itemId: string, value: unknown, itemDef: ChecklistItem): void {
	const status = itemDef.status ?? { kind: 'boolean' as const }

	if (status.kind === 'boolean') {
		if (typeof value !== 'boolean') {
			throw new Error(`Invalid value for item "${itemId}": expected boolean, got ${typeof value}`)
		}
	} else if (status.kind === 'enum') {
		if (typeof value !== 'string') {
			throw new Error(`Invalid value for item "${itemId}": expected string, got ${typeof value}`)
		}
		const validValues = status.options.map((o) => o.value)
		if (!validValues.includes(value)) {
			throw new Error(`Invalid value for item "${itemId}": "${value}" is not in [${validValues.join(', ')}]`)
		}
	}
}

// ============================================================================
// RuntimeChecklist Factory
// ============================================================================

interface RuntimeChecklistConfigDraft<C extends Checklist> {
	checklist: C
	items: Record<string, boolean | string>
	targetLayer: string
	completedAt?: undefined
}

interface RuntimeChecklistConfigCompleted<C extends Checklist> {
	checklist: C
	items: Record<string, boolean | string>
	targetLayer: string
	completedAt: string
}

type RuntimeChecklistConfig<C extends Checklist> = RuntimeChecklistConfigDraft<C> | RuntimeChecklistConfigCompleted<C>

/**
 * Creates a RuntimeChecklist object (replaces DraftChecklist and CompletedChecklist classes)
 * Uses function overloads for correct return type narrowing.
 */
function createRuntimeChecklist<C extends Checklist>(config: RuntimeChecklistConfigDraft<C>): DraftChecklist<C>
function createRuntimeChecklist<C extends Checklist>(config: RuntimeChecklistConfigCompleted<C>): CompletedChecklist<C>
function createRuntimeChecklist<C extends Checklist>(config: RuntimeChecklistConfig<C>): RuntimeChecklist<C>
function createRuntimeChecklist<C extends Checklist>(config: RuntimeChecklistConfig<C>): RuntimeChecklist<C> {
	const { checklist: checklistDef, items: itemValues, targetLayer, completedAt } = config

	// Build item lookup map and validate
	const itemDefs = new Map<string, ChecklistItem>()
	const checklistItems = (checklistDef.items ?? []) as ChecklistItem[]
	for (const item of checklistItems) {
		itemDefs.set(item.id, item)
	}

	// Validate provided values
	const validatedItems = new Map<string, boolean | string>()
	for (const [itemId, value] of Object.entries(itemValues)) {
		const itemDef = itemDefs.get(itemId)
		if (!itemDef) {
			const validIds = Array.from(itemDefs.keys())
			throw new Error(`Unknown item "${itemId}". Valid item IDs are: [${validIds.join(', ')}]`)
		}
		validateItemValue(itemId, value, itemDef)
		validatedItems.set(itemId, value)
	}

	const getAllItems = (): InferChecklistPayload<C> => {
		const result: Record<string, boolean | string> = {}
		for (const [key, value] of validatedItems) {
			result[key] = value
		}
		return result as InferChecklistPayload<C>
	}

	const getItem = <K extends keyof InferChecklistPayload<C> & string>(itemId: K): InferChecklistPayload<C>[K] => {
		if (!validatedItems.has(itemId)) {
			const validIds = Array.from(validatedItems.keys())
			throw new Error(`Unknown item "${itemId}". Valid item IDs are: [${validIds.join(', ')}]`)
		}
		return validatedItems.get(itemId) as InferChecklistPayload<C>[K]
	}

	const render = async <Output = string | Uint8Array>(
		options?: RuntimeChecklistRenderOptions<Output>,
	): Promise<Output> => {
		// Resolve layer key and content
		const layers = checklistDef.layers
		if (!layers || Object.keys(layers).length === 0) {
			throw new Error('Checklist has no layers defined')
		}

		const key = options?.layer || targetLayer || checklistDef.defaultLayer || Object.keys(layers)[0]
		if (!key) {
			throw new Error('No layer key provided and no defaultLayer set.')
		}

		const layerSpec = layers[key]
		if (!layerSpec) {
			throw new Error(`Layer "${key}" not found. Available layers: ${Object.keys(layers).join(', ')}`)
		}

		// Get layer content
		let layerContent: string | Uint8Array | Buffer
		let bindings: Record<string, string> | undefined

		if (layerSpec.kind === 'inline') {
			layerContent = layerSpec.text
			bindings = layerSpec.bindings
		} else if (layerSpec.kind === 'file') {
			if (options?.resolver) {
				const bytes = await options.resolver.read(layerSpec.path)
				if (layerSpec.mimeType.startsWith('text/') || layerSpec.mimeType === 'application/json') {
					layerContent = new TextDecoder().decode(bytes)
				} else {
					layerContent = bytes
				}
			} else {
				throw new Error(`Layer "${key}" is file-backed but no resolver was provided.`)
			}
			bindings = layerSpec.bindings
		} else {
			throw new Error('Unknown layer spec kind')
		}

		// Resolve bindingsFrom reference if no direct bindings
		if (!bindings && layerSpec.bindingsFrom) {
			const refLayer = layers[layerSpec.bindingsFrom]
			if (!refLayer) {
				throw new Error(`bindingsFrom "${layerSpec.bindingsFrom}" references unknown layer. Available: ${Object.keys(layers).join(', ')}`)
			}
			bindings = refLayer.bindings
		}

		// If no renderer provided, return raw layer content
		if (!options?.renderer) {
			return layerContent as Output
		}

		// Build checklist data for rendering
		// Convert items to array format with values for template iteration
		const checklistItems = (checklistDef.items ?? []) as ChecklistItem[]
		const itemsWithValues = checklistItems.map((item) => ({
			id: item.id,
			title: item.title,
			description: item.description,
			value: validatedItems.get(item.id),
		}))

		const fullData = {
			schema: {
				name: checklistDef.name,
				version: checklistDef.version,
				title: checklistDef.title,
				description: checklistDef.description,
				code: checklistDef.code,
				releaseDate: checklistDef.releaseDate,
				metadata: checklistDef.metadata,
			},
			// Top-level title for template access
			title: checklistDef.title,
			description: checklistDef.description,
			// Items array for {{#each items}}
			items: itemsWithValues,
			// Also include raw item values at top level for direct access
			...getAllItems(),
		}

		const template: RendererLayer = {
			type: 'text',
			content: layerContent,
			mimeType: layerSpec.mimeType,
			...(bindings && { bindings }),
		}

		// Create a minimal form-like object for the renderer
		// Renderers mainly use template and data, form is just context
		const formContext = {
			kind: 'form' as const,
			name: checklistDef.name,
			version: checklistDef.version,
			title: checklistDef.title,
			description: checklistDef.description,
			fields: {},
		} as unknown as Form

		return await options.renderer.render({
			template,
			form: formContext,
			data: { fields: fullData },
			bindings,
		})
	}

	// Draft phase
	if (!completedAt) {
		const draft: DraftChecklist<C> = {
			checklist: checklistDef,
			targetLayer,
			phase: 'draft',
			completedAt: undefined,

			get name() {
				return checklistDef.name
			},
			get version() {
				return checklistDef.version
			},
			get title() {
				return checklistDef.title
			},
			get items() {
				return checklistDef.items
			},
			get layers() {
				return checklistDef.layers
			},

			getItem,
			getAllItems,
			isValid: () => true as const,
			render,

			setItem<K extends keyof InferChecklistPayload<C> & string>(
				itemId: K,
				value: InferChecklistPayload<C>[K],
			): DraftChecklist<C> {
				const newItems = { ...getAllItems(), [itemId]: value }
				return createRuntimeChecklist({
					checklist: checklistDef,
					items: newItems as Record<string, boolean | string>,
					targetLayer,
				})
			},

			updateItems(updates: Partial<InferChecklistPayload<C>>): DraftChecklist<C> {
				const newItems = { ...getAllItems(), ...updates }
				return createRuntimeChecklist({
					checklist: checklistDef,
					items: newItems as Record<string, boolean | string>,
					targetLayer,
				})
			},

			setTargetLayer<K extends keyof C['layers'] & string>(layer: K): DraftChecklist<C> {
				const layers = checklistDef.layers ?? {}
				if (!layers[layer]) {
					throw new Error(
						`Layer "${layer}" not found in checklist. Available layers: ${Object.keys(layers).join(', ') || 'none'}`,
					)
				}
				return createRuntimeChecklist({
					checklist: checklistDef,
					items: getAllItems() as Record<string, boolean | string>,
					targetLayer: layer,
				})
			},

			complete(): CompletedChecklist<C> {
				return createRuntimeChecklist({
					checklist: checklistDef,
					items: getAllItems() as Record<string, boolean | string>,
					targetLayer,
					completedAt: new Date().toISOString(),
				})
			},

			toJSON(): RuntimeChecklistJSON<C> {
				return {
					phase: 'draft',
					checklist: checklistDef,
					items: getAllItems() as Record<string, boolean | string>,
					targetLayer,
				}
			},

			toYAML(): string {
				return toYAML(this.toJSON())
			},

			clone(): DraftChecklist<C> {
				return createRuntimeChecklist({
					checklist: structuredClone(checklistDef),
					items: structuredClone(getAllItems() as Record<string, boolean | string>),
					targetLayer,
				})
			},
		}
		return draft
	}

	// Completed phase
	const completed: CompletedChecklist<C> = {
		checklist: checklistDef,
		targetLayer,
		phase: 'completed',
		completedAt,

		get name() {
			return checklistDef.name
		},
		get version() {
			return checklistDef.version
		},
		get title() {
			return checklistDef.title
		},
		get items() {
			return checklistDef.items
		},
		get layers() {
			return checklistDef.layers
		},

		getItem,
		getAllItems,
		isValid: () => true as const,
		render,

		toJSON(): RuntimeChecklistJSON<C> {
			return {
				phase: 'completed',
				checklist: checklistDef,
				items: getAllItems() as Record<string, boolean | string>,
				targetLayer,
				completedAt,
			}
		},

		toYAML(): string {
			return toYAML(this.toJSON())
		},

		clone(): CompletedChecklist<C> {
			return createRuntimeChecklist({
				checklist: structuredClone(checklistDef),
				items: structuredClone(getAllItems() as Record<string, boolean | string>),
				targetLayer,
				completedAt,
			})
		},
	}
	return completed
}

/**
 * Load a RuntimeChecklist from JSON
 */
export function runtimeChecklistFromJSON<C extends Checklist>(json: RuntimeChecklistJSON<C>): RuntimeChecklist<C> {
	return createRuntimeChecklist({
		checklist: json.checklist,
		items: json.items,
		targetLayer: json.targetLayer,
		completedAt: 'completedAt' in json ? json.completedAt : undefined,
	})
}

// ============================================================================
// ChecklistInstance Factory
// ============================================================================

/**
 * Creates a ChecklistInstance object (replaces ChecklistInstance class)
 */
function createChecklistInstance<C extends Checklist>(checklistDef: C): ChecklistInstance<C> {
	const artifactMethods = withArtifactMethods(checklistDef)

	const instance: ChecklistInstance<C> = {
		...artifactMethods,

		// Checklist-specific properties (type assertions needed for conditional types)
		items: checklistDef.items as ChecklistInstance<C>['items'],
		layers: checklistDef.layers as ChecklistInstance<C>['layers'],
			defaultLayer: checklistDef.defaultLayer as ChecklistInstance<C>['defaultLayer'],

			validateItemInput(
				input: ChecklistItemInputValidationInput,
			): ProgressiveValidationResult<boolean | string> {
				return validateChecklistItemInput(checklistDef, input)
			},

			validateItemsPatch(
				items: unknown,
			): ProgressiveValidationResult<Record<string, boolean | string>> {
				return validateChecklistItemsPatch(checklistDef, items)
			},

			fill(data: InferChecklistPayload<C>): DraftChecklist<C> {
				const targetLayer =
				checklistDef.defaultLayer || (checklistDef.layers ? Object.keys(checklistDef.layers)[0] : '') || ''

			return createRuntimeChecklist({
				checklist: checklistDef,
				items: data as Record<string, boolean | string>,
				targetLayer,
			})
		},

		safeFill(
			data: InferChecklistPayload<C>,
		): { success: true; data: DraftChecklist<C> } | { success: false; error: Error } {
			try {
				return {
					success: true,
					data: this.fill(data),
				}
			} catch (err) {
				return { success: false, error: err as Error }
			}
		},

		async render<Output = string | Uint8Array>(
			options?: RuntimeChecklistRenderOptions<Output>,
		): Promise<Output> {
			// Resolve layer key and content
			const layers = checklistDef.layers
			if (!layers || Object.keys(layers).length === 0) {
				throw new Error('Checklist has no layers defined')
			}

			const key = options?.layer || checklistDef.defaultLayer || Object.keys(layers)[0]
			if (!key) {
				throw new Error('No layer key provided and no defaultLayer set.')
			}

			const layerSpec = layers[key]
			if (!layerSpec) {
				throw new Error(`Layer "${key}" not found. Available layers: ${Object.keys(layers).join(', ')}`)
			}

			// Get layer content
			let layerContent: string | Uint8Array | Buffer
			let bindings: Record<string, string> | undefined

			if (layerSpec.kind === 'inline') {
				layerContent = layerSpec.text
				bindings = layerSpec.bindings
			} else if (layerSpec.kind === 'file') {
				if (options?.resolver) {
					const bytes = await options.resolver.read(layerSpec.path)
					if (layerSpec.mimeType.startsWith('text/') || layerSpec.mimeType === 'application/json') {
						layerContent = new TextDecoder().decode(bytes)
					} else {
						layerContent = bytes
					}
				} else {
					throw new Error(`Layer "${key}" is file-backed but no resolver was provided.`)
				}
				bindings = layerSpec.bindings
			} else {
				throw new Error('Unknown layer spec kind')
			}

			// Resolve bindingsFrom reference if no direct bindings
			if (!bindings && layerSpec.bindingsFrom) {
				const refLayer = layers[layerSpec.bindingsFrom]
				if (!refLayer) {
					throw new Error(`bindingsFrom "${layerSpec.bindingsFrom}" references unknown layer. Available: ${Object.keys(layers).join(', ')}`)
				}
				bindings = refLayer.bindings
			}

			// If no renderer provided, return raw layer content
			if (!options?.renderer) {
				return layerContent as Output
			}

			// Build checklist data for rendering (no item values since not filled)
			const checklistItems = (checklistDef.items ?? []) as ChecklistItem[]
			const itemsWithoutValues = checklistItems.map((item) => ({
				id: item.id,
				title: item.title,
				description: item.description,
				value: undefined,
			}))

			const fullData = {
				schema: {
					name: checklistDef.name,
					version: checklistDef.version,
					title: checklistDef.title,
					description: checklistDef.description,
					code: checklistDef.code,
					releaseDate: checklistDef.releaseDate,
					metadata: checklistDef.metadata,
				},
				title: checklistDef.title,
				description: checklistDef.description,
				items: itemsWithoutValues,
			}

			const template: RendererLayer = {
				type: 'text',
				content: layerContent,
				mimeType: layerSpec.mimeType,
				...(bindings && { bindings }),
			}

			const formContext = {
				kind: 'form' as const,
				name: checklistDef.name,
				version: checklistDef.version,
				title: checklistDef.title,
				description: checklistDef.description,
				fields: {},
			} as unknown as Form

			return await options.renderer.render({
				template,
				form: formContext,
				data: { fields: fullData },
				bindings,
			})
		},

		clone(): ChecklistInstance<C> {
			return createChecklistInstance(structuredClone(checklistDef))
		},
	}

	return instance
}

// ============================================================================
// ChecklistBuilder
// ============================================================================

export interface ChecklistBuilderInterface<TItems extends ChecklistItem[] = []> {
	from(checklistValue: Checklist): ChecklistBuilderInterface<TItems>
	name(value: string): ChecklistBuilderInterface<TItems>
	version(value?: string): ChecklistBuilderInterface<TItems>
	title(value?: string): ChecklistBuilderInterface<TItems>
	description(value: string | undefined): ChecklistBuilderInterface<TItems>
	code(value: string | undefined): ChecklistBuilderInterface<TItems>
	language(value: string): ChecklistBuilderInterface<TItems>
	releaseDate(value: string | undefined): ChecklistBuilderInterface<TItems>
	metadata(value: Metadata | undefined): ChecklistBuilderInterface<TItems>
	instructions(value: ContentRef): ChecklistBuilderInterface<TItems>
	agentInstructions(value: ContentRef): ChecklistBuilderInterface<TItems>
	item(itemDef: Buildable<ChecklistItem>): ChecklistBuilderInterface<TItems>
	itemWithBooleanStatus(
		id: string,
		title: string,
		options?: { description?: string; default?: boolean },
	): ChecklistBuilderInterface<TItems>
	itemWithEnumStatus(
		id: string,
		title: string,
		options: {
			statusOptions: Array<{ value: string; label: string; description?: string }>
			description?: string
			defaultStatus?: string
		},
	): ChecklistBuilderInterface<TItems>
	items<const I extends ChecklistItem[]>(itemsArray: { [K in keyof I]: Buildable<I[K]> }): ChecklistBuilderInterface<I>
	layers(value: Record<string, Layer | FileLayerBuilderType | InlineLayerBuilderType>): ChecklistBuilderInterface<TItems>
	layer(key: string, layerDef: Layer | FileLayerBuilderType | InlineLayerBuilderType): ChecklistBuilderInterface<TItems>
	inlineLayer(
		key: string,
		layer: {
			mimeType: string
			text: string
			title?: string
			description?: string
			bindings?: Record<string, string>
		},
	): ChecklistBuilderInterface<TItems>
	fileLayer(
		key: string,
		layer: {
			mimeType: string
			path: string
			title?: string
			description?: string
			checksum?: string
			bindings?: Record<string, string>
		},
	): ChecklistBuilderInterface<TItems>
	defaultLayer(key: string): ChecklistBuilderInterface<TItems>
	build(): ChecklistInstance<Omit<Checklist, 'items'> & { items: TItems }>
}

/**
 * Creates a ChecklistBuilder (closure-based, replaces ChecklistBuilder class)
 */
function createChecklistBuilder<TItems extends ChecklistItem[] = []>(): ChecklistBuilderInterface<TItems> {
	const _def: Record<string, unknown> = {
		kind: 'checklist',
		name: '',
		version: undefined,
		title: undefined,
		description: undefined,
		code: undefined,
		language: undefined,
		releaseDate: undefined,
		metadata: {},
		instructions: undefined,
		agentInstructions: undefined,
		items: [],
		layers: undefined,
		defaultLayer: undefined,
	}

	const builder: ChecklistBuilderInterface<TItems> = {
		from(checklistValue: Checklist) {
			_def.kind = 'checklist'
			_def.name = checklistValue.name
			_def.version = checklistValue.version
			_def.title = checklistValue.title
			_def.description = checklistValue.description
			_def.code = checklistValue.code
			_def.language = checklistValue.language
			_def.releaseDate = checklistValue.releaseDate
			_def.metadata = checklistValue.metadata ? { ...checklistValue.metadata } : {}
			_def.instructions = checklistValue.instructions
			_def.agentInstructions = checklistValue.agentInstructions
			_def.items = checklistValue.items.map((item) => parseChecklistItem(item))
			_def.layers = checklistValue.layers
				? Object.fromEntries(Object.entries(checklistValue.layers).map(([key, layer]) => [key, parseLayer(layer)]))
				: undefined
			_def.defaultLayer = checklistValue.defaultLayer
			return builder
		},

		name(value: string) {
			_def.name = value
			return builder
		},

		version(value?: string) {
			_def.version = value
			return builder
		},

		title(value?: string) {
			_def.title = value
			return builder
		},

		description(value: string | undefined) {
			_def.description = value
			return builder
		},

		code(value: string | undefined) {
			_def.code = value
			return builder
		},

		language(value: string) {
			_def.language = value
			return builder
		},

		releaseDate(value: string | undefined) {
			_def.releaseDate = value
			return builder
		},

		metadata(value: Metadata | undefined) {
			_def.metadata = value
			return builder
		},

		instructions(value: ContentRef) {
			_def.instructions = value
			return builder
		},

		agentInstructions(value: ContentRef) {
			_def.agentInstructions = value
			return builder
		},

		item(itemDef: Buildable<ChecklistItem>) {
			const items = (_def.items as ChecklistItem[]) || []
			items.push(parseChecklistItem(resolveBuildable(itemDef)))
			_def.items = items
			return builder
		},

		itemWithBooleanStatus(id: string, title: string, options?: { description?: string; default?: boolean }) {
			const item: ChecklistItem = {
				id,
				title,
				...(options?.description && { description: options.description }),
				status: {
					kind: 'boolean',
					...(options?.default !== undefined && { default: options.default }),
				},
			}
			return builder.item(item)
		},

		itemWithEnumStatus(
			id: string,
			title: string,
			options: {
				statusOptions: Array<{ value: string; label: string; description?: string }>
				description?: string
				defaultStatus?: string
			},
		) {
			const item: ChecklistItem = {
				id,
				title,
				...(options.description && { description: options.description }),
				status: {
					kind: 'enum',
					options: options.statusOptions,
					...(options.defaultStatus && { default: options.defaultStatus }),
				},
			}
			return builder.item(item)
		},

		items<const I extends ChecklistItem[]>(itemsArray: { [K in keyof I]: Buildable<I[K]> }) {
			const parsed: ChecklistItem[] = []
			for (const itemDef of itemsArray as Array<Buildable<ChecklistItem>>) {
				parsed.push(parseChecklistItem(resolveBuildable(itemDef)))
			}
			_def.items = parsed
			return builder as unknown as ChecklistBuilderInterface<I>
		},

		layers(value: Record<string, Layer | FileLayerBuilderType | InlineLayerBuilderType>) {
			const parsed: Record<string, Layer> = {}
			for (const [key, layerValue] of Object.entries(value)) {
				const resolved = layerBuilder.isBuilder(layerValue) ? layerBuilder.resolve(layerValue) : layerValue
				parsed[key] = parseLayer(resolved)
			}
			_def.layers = parsed
			return builder
		},

		layer(key: string, layerDef: Layer | FileLayerBuilderType | InlineLayerBuilderType) {
			const layers = (_def.layers as Record<string, Layer>) || {}
			const resolved = layerBuilder.isBuilder(layerDef) ? layerBuilder.resolve(layerDef) : layerDef
			layers[key] = parseLayer(resolved)
			_def.layers = layers
			return builder
		},

		inlineLayer(
			key: string,
			layer: {
				mimeType: string
				text: string
				title?: string
				description?: string
				bindings?: Record<string, string>
			},
		) {
			return builder.layer(key, { kind: 'inline', ...layer })
		},

		fileLayer(
			key: string,
			layer: {
				mimeType: string
				path: string
				title?: string
				description?: string
				checksum?: string
				bindings?: Record<string, string>
			},
		) {
			return builder.layer(key, { kind: 'file', ...layer })
		},

		defaultLayer(key: string) {
			_def.defaultLayer = key
			return builder
		},

		build(): ChecklistInstance<Omit<Checklist, 'items'> & { items: TItems }> {
			const payload = Object.fromEntries(Object.entries(_def).filter(([, value]) => value !== undefined))
			const parsed = parseChecklist(payload)
			return createChecklistInstance(parsed as Omit<Checklist, 'items'> & { items: TItems })
		},
	}

	return builder
}

// ============================================================================
// Checklist API
// ============================================================================

type ChecklistAPI = {
	(): ChecklistBuilderInterface
	<const T extends ChecklistInput>(input: T): ChecklistInstance<T & { kind: 'checklist' }>
	from(input: unknown): ChecklistInstance<Checklist>
	safeFrom(input: unknown): { success: true; data: ChecklistInstance<Checklist> } | { success: false; error: Error }
}

function checklistImpl(): ChecklistBuilderInterface
function checklistImpl<const T extends ChecklistInput>(input: T): ChecklistInstance<T & { kind: 'checklist' }>
function checklistImpl<const T extends ChecklistInput>(
	input?: T,
): ChecklistBuilderInterface | ChecklistInstance<T & { kind: 'checklist' }> {
	if (input !== undefined) {
		const withKind = { ...input, kind: 'checklist' as const }
		const parsed = parseChecklist(withKind) as T & { kind: 'checklist' }
		return createChecklistInstance(parsed)
	}
	return createChecklistBuilder()
}

export const checklist: ChecklistAPI = Object.assign(checklistImpl, {
	from: (input: unknown): ChecklistInstance<Checklist> => {
		const parsed = parseChecklist(input) as Checklist
		return createChecklistInstance(parsed)
	},
	safeFrom: (input: unknown): { success: true; data: ChecklistInstance<Checklist> } | { success: false; error: Error } => {
		try {
			const parsed = parseChecklist(input) as Checklist
			return {
				success: true,
				data: createChecklistInstance(parsed),
			}
		} catch (err) {
			return { success: false, error: err as Error }
		}
	},
})
