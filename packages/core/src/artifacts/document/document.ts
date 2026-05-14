/**
 * Document Artifact - Closure-based implementation
 *
 * This replaces the class-based DocumentInstance, DraftDocument, and FinalDocument
 * with a single file using closures and composition.
 */

import type { Document, Layer, Metadata, ContentRef } from '@paradoc/types'
import type { DraftDocumentJSON, FinalDocumentJSON } from '@paradoc/types'
import { parseDocument, parseLayer } from '@/validation/artifact-parsers'
import { toYAML } from '@/serialization/serialization'
import { withArtifactMethods, type ArtifactMethods } from '../shared/artifact-methods'
import { resolveAndRenderLayer, type LayerRenderOptions } from '../shared/render-layer'
import { layer as layerBuilder, type FileLayerBuilderType, type InlineLayerBuilderType } from '@/artifacts/builders/layer'

// ============================================================================
// Types
// ============================================================================

/**
 * Document input type for direct creation (kind is optional)
 */
export type DocumentInput = Omit<Document, 'kind'> & { kind?: 'document' }

/**
 * RuntimeDocument JSON representation
 */
export type RuntimeDocumentJSON<D extends Document> =
	| DraftDocumentJSON<D>
	| FinalDocumentJSON<D>

/**
 * DocumentInstance - design-time wrapper for Document artifacts
 */
export interface DocumentInstance<D extends Document> extends ArtifactMethods<D> {
	/** Document layers */
	readonly layers: D extends { layers: infer L } ? L : Record<string, Layer> | undefined

	/** Default layer key */
	readonly defaultLayer: D extends { defaultLayer: infer DL } ? DL : string | undefined

	/**
	 * Create a RuntimeDocument in draft phase.
	 * @param targetLayer - Optional target layer (defaults to defaultLayer)
	 */
	prepare<K extends keyof D['layers'] & string>(targetLayer?: K): DraftDocument<D>

	/**
	 * Render document content directly.
	 * @param options - Render options including resolver and layer override
	 */
	render(options?: LayerRenderOptions): Promise<string | Uint8Array>

	/**
	 * Create an exact copy of this instance.
	 */
	clone(): DocumentInstance<D>
}

// ============================================================================
// Phase-Specific Interfaces (Discriminated Union)
// ============================================================================

/**
 * Base interface with shared read-only properties and methods (all phases)
 */
interface RuntimeDocumentBase<D extends Document> {
	/** Embedded document definition */
	readonly document: D

	/** Target layer key */
	readonly targetLayer: string

	// Convenience getters
	readonly name: string
	readonly version: string | undefined
	readonly title: string | undefined
	readonly layers: D['layers']

	/**
	 * Render the document content.
	 */
	render(options?: LayerRenderOptions): Promise<string | Uint8Array>

	/**
	 * Serialize to JSON.
	 */
	toJSON(): RuntimeDocumentJSON<D>

	/**
	 * Serialize to YAML.
	 */
	toYAML(): string
}

/**
 * Draft phase - can modify target layer and finalize
 */
export interface DraftDocument<D extends Document> extends RuntimeDocumentBase<D> {
	/** Phase discriminator */
	readonly phase: 'draft'

	/** Finalization timestamp (always undefined for draft) */
	readonly finalizedAt: undefined

	/**
	 * Change target layer.
	 */
	setTargetLayer<K extends keyof D['layers'] & string>(layer: K): DraftDocument<D>

	/**
	 * Finalize the document (draft → final).
	 */
	finalize(): FinalDocument<D>

	/**
	 * Create an exact copy.
	 */
	clone(): DraftDocument<D>
}

/**
 * Final phase - immutable, read-only
 */
export interface FinalDocument<D extends Document> extends RuntimeDocumentBase<D> {
	/** Phase discriminator */
	readonly phase: 'final'

	/** Finalization timestamp (always defined for final) */
	readonly finalizedAt: string

	/**
	 * Create an exact copy.
	 */
	clone(): FinalDocument<D>
}

/**
 * RuntimeDocument - discriminated union of all phases
 */
export type RuntimeDocument<D extends Document> = DraftDocument<D> | FinalDocument<D>

// ============================================================================
// RuntimeDocument Factory
// ============================================================================

interface RuntimeDocumentConfigDraft<D extends Document> {
	document: D
	targetLayer: string
	finalizedAt?: undefined
}

interface RuntimeDocumentConfigFinal<D extends Document> {
	document: D
	targetLayer: string
	finalizedAt: string
}

type RuntimeDocumentConfig<D extends Document> = RuntimeDocumentConfigDraft<D> | RuntimeDocumentConfigFinal<D>

/**
 * Creates a RuntimeDocument object (replaces DraftDocument and FinalDocument classes)
 * Uses function overloads for correct return type narrowing.
 */
function createRuntimeDocument<D extends Document>(config: RuntimeDocumentConfigDraft<D>): DraftDocument<D>
function createRuntimeDocument<D extends Document>(config: RuntimeDocumentConfigFinal<D>): FinalDocument<D>
function createRuntimeDocument<D extends Document>(config: RuntimeDocumentConfig<D>): RuntimeDocument<D>
function createRuntimeDocument<D extends Document>(config: RuntimeDocumentConfig<D>): RuntimeDocument<D> {
	const { document: doc, targetLayer, finalizedAt } = config

	// Shared render function
	const render = (options?: LayerRenderOptions): Promise<string | Uint8Array> => {
		return resolveAndRenderLayer(doc.layers, targetLayer, doc.defaultLayer, options)
	}

	// Draft phase
	if (!finalizedAt) {
		const draft: DraftDocument<D> = {
			document: doc,
			targetLayer,
			phase: 'draft',
			finalizedAt: undefined,

			get name() {
				return doc.name
			},
			get version() {
				return doc.version
			},
			get title() {
				return doc.title
			},
			get layers() {
				return doc.layers
			},

			render,

			setTargetLayer<K extends keyof D['layers'] & string>(layer: K): DraftDocument<D> {
				const layers = doc.layers ?? {}
				if (!layers[layer]) {
					throw new Error(
						`Layer "${layer}" not found in document. Available layers: ${Object.keys(layers).join(', ') || 'none'}`,
					)
				}
				return createRuntimeDocument({ document: doc, targetLayer: layer })
			},

			finalize(): FinalDocument<D> {
				return createRuntimeDocument({
					document: doc,
					targetLayer,
					finalizedAt: new Date().toISOString(),
				})
			},

			toJSON(): RuntimeDocumentJSON<D> {
				return {
					phase: 'draft',
					document: doc,
					targetLayer,
				}
			},

			toYAML(): string {
				return toYAML(this.toJSON())
			},

			clone(): DraftDocument<D> {
				return createRuntimeDocument({
					document: structuredClone(doc),
					targetLayer,
				})
			},
		}
		return draft
	}

	// Final phase
	const final: FinalDocument<D> = {
		document: doc,
		targetLayer,
		phase: 'final',
		finalizedAt,

		get name() {
			return doc.name
		},
		get version() {
			return doc.version
		},
		get title() {
			return doc.title
		},
		get layers() {
			return doc.layers
		},

		render,

		toJSON(): RuntimeDocumentJSON<D> {
			return {
				phase: 'final',
				document: doc,
				targetLayer,
				finalizedAt,
			}
		},

		toYAML(): string {
			return toYAML(this.toJSON())
		},

		clone(): FinalDocument<D> {
			return createRuntimeDocument({
				document: structuredClone(doc),
				targetLayer,
				finalizedAt,
			})
		},
	}
	return final
}

/**
 * Load a RuntimeDocument from JSON
 */
export function runtimeDocumentFromJSON<D extends Document>(json: RuntimeDocumentJSON<D>): RuntimeDocument<D> {
	return createRuntimeDocument({
		document: json.document,
		targetLayer: json.targetLayer,
		finalizedAt: 'finalizedAt' in json ? json.finalizedAt : undefined,
	})
}

// ============================================================================
// DocumentInstance Factory
// ============================================================================

/**
 * Creates a DocumentInstance object (replaces DocumentInstance class)
 */
function createDocumentInstance<D extends Document>(doc: D): DocumentInstance<D> {
	const artifactMethods = withArtifactMethods(doc)

	const instance: DocumentInstance<D> = {
		...artifactMethods,

		// Document-specific properties (type assertions needed for conditional types)
		layers: doc.layers as DocumentInstance<D>['layers'],
		defaultLayer: doc.defaultLayer as DocumentInstance<D>['defaultLayer'],

		prepare<K extends keyof D['layers'] & string>(targetLayer?: K): DraftDocument<D> {
			const layers = doc.layers ?? {}
			const layerKeys = Object.keys(layers)

			let resolvedTargetLayer: string

			if (targetLayer !== undefined) {
				if (!layers[targetLayer]) {
					throw new Error(
						`Layer "${targetLayer}" not found in document. Available layers: ${layerKeys.join(', ') || 'none'}`,
					)
				}
				resolvedTargetLayer = targetLayer
			} else {
				resolvedTargetLayer = doc.defaultLayer ?? layerKeys[0] ?? ''
			}

			return createRuntimeDocument({
				document: doc,
				targetLayer: resolvedTargetLayer,
			})
		},

		render(options?: LayerRenderOptions): Promise<string | Uint8Array> {
			return resolveAndRenderLayer(doc.layers, undefined, doc.defaultLayer, options)
		},

		clone(): DocumentInstance<D> {
			return createDocumentInstance(structuredClone(doc))
		},
	}

	return instance
}

// ============================================================================
// DocumentBuilder
// ============================================================================

export interface DocumentBuilderInterface {
	from(doc: Document): DocumentBuilderInterface
	name(value: string): DocumentBuilderInterface
	version(value?: string): DocumentBuilderInterface
	title(value?: string): DocumentBuilderInterface
	description(value: string): DocumentBuilderInterface
	code(value: string): DocumentBuilderInterface
	releaseDate(value: string): DocumentBuilderInterface
	metadata(value: Metadata): DocumentBuilderInterface
	instructions(value: ContentRef): DocumentBuilderInterface
	agentInstructions(value: ContentRef): DocumentBuilderInterface
	layers(value: Record<string, Layer | FileLayerBuilderType | InlineLayerBuilderType>): DocumentBuilderInterface
	layer(key: string, layerDef: Layer | FileLayerBuilderType | InlineLayerBuilderType): DocumentBuilderInterface
	inlineLayer(
		key: string,
		layer: { mimeType: string; text: string; title?: string; description?: string },
	): DocumentBuilderInterface
	fileLayer(
		key: string,
		layer: { mimeType: string; path: string; title?: string; description?: string; checksum?: string },
	): DocumentBuilderInterface
	defaultLayer(key: string): DocumentBuilderInterface
	build(): DocumentInstance<Document>
}

/**
 * Creates a DocumentBuilder (closure-based, replaces DocumentBuilder class)
 */
function createDocumentBuilder(): DocumentBuilderInterface {
	const _def: Record<string, unknown> = {
		kind: 'document',
		name: '',
		version: undefined,
		title: undefined,
		description: undefined,
		code: undefined,
		releaseDate: undefined,
		metadata: {},
		instructions: undefined,
		agentInstructions: undefined,
		layers: undefined,
		defaultLayer: undefined,
	}

	const builder: DocumentBuilderInterface = {
		from(doc: Document) {
			_def.kind = 'document'
			_def.name = doc.name
			_def.version = doc.version
			_def.title = doc.title
			_def.description = doc.description
			_def.code = doc.code
			_def.releaseDate = doc.releaseDate
			_def.metadata = doc.metadata ? { ...doc.metadata } : {}
			_def.instructions = doc.instructions
			_def.agentInstructions = doc.agentInstructions
			_def.layers = doc.layers
				? Object.fromEntries(Object.entries(doc.layers).map(([key, layer]) => [key, parseLayer(layer)]))
				: undefined
			_def.defaultLayer = doc.defaultLayer
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

		description(value: string) {
			_def.description = value
			return builder
		},

		code(value: string) {
			_def.code = value
			return builder
		},

		releaseDate(value: string) {
			_def.releaseDate = value
			return builder
		},

		metadata(value: Metadata) {
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
			layer: { mimeType: string; text: string; title?: string; description?: string },
		) {
			return builder.layer(key, { kind: 'inline', ...layer })
		},

		fileLayer(
			key: string,
			layer: { mimeType: string; path: string; title?: string; description?: string; checksum?: string },
		) {
			return builder.layer(key, { kind: 'file', ...layer })
		},

		defaultLayer(key: string) {
			_def.defaultLayer = key
			return builder
		},

		build(): DocumentInstance<Document> {
			const payload = Object.fromEntries(Object.entries(_def).filter(([, value]) => value !== undefined))
			const parsed = parseDocument(payload)
			return createDocumentInstance(parsed)
		},
	}

	return builder
}

// ============================================================================
// Document API
// ============================================================================

type DocumentAPI = {
	(): DocumentBuilderInterface
	<const T extends DocumentInput>(input: T): DocumentInstance<T & { kind: 'document' }>
	from(input: unknown): DocumentInstance<Document>
	safeFrom(input: unknown): { success: true; data: DocumentInstance<Document> } | { success: false; error: Error }
}

function documentImpl(): DocumentBuilderInterface
function documentImpl<const T extends DocumentInput>(input: T): DocumentInstance<T & { kind: 'document' }>
function documentImpl<const T extends DocumentInput>(
	input?: T,
): DocumentBuilderInterface | DocumentInstance<T & { kind: 'document' }> {
	if (input !== undefined) {
		const withKind = { ...input, kind: 'document' as const }
		const parsed = parseDocument(withKind) as T & { kind: 'document' }
		return createDocumentInstance(parsed)
	}
	return createDocumentBuilder()
}

export const document: DocumentAPI = Object.assign(documentImpl, {
	from: (input: unknown): DocumentInstance<Document> => {
		const parsed = parseDocument(input) as Document
		return createDocumentInstance(parsed)
	},
	safeFrom: (
		input: unknown,
	): { success: true; data: DocumentInstance<Document> } | { success: false; error: Error } => {
		try {
			const parsed = parseDocument(input) as Document
			return {
				success: true,
				data: createDocumentInstance(parsed),
			}
		} catch (err) {
			return { success: false, error: err as Error }
		}
	},
})
