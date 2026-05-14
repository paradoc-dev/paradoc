/**
 * Bundle Artifact - Closure-based implementation
 *
 * This replaces the class-based BundleInstance, DraftBundle, SignableBundle, and ExecutedBundle
 * with a single file using closures and composition.
 */

import type {
	Bundle,
	BundleContentItem,
	Document,
	Form,
	Checklist,
	Layer,
	Metadata,
	DefsSection,
	Expression,
	CondExpr,
	BinaryContent,
	Resolver,
	DraftBundleJSON,
	SignableBundleJSON,
	ExecutedBundleJSON,
	RuntimeContentJSON,
	ContentRef,
} from '@paradoc/types'
import {
	parseBundle as parseBundleSchema,
	parseBundleContentItem,
} from '@/validation/artifact-parsers'
import { toYAML } from '@/serialization/serialization'
import { withArtifactMethods, type ArtifactMethods } from '../shared/artifact-methods'
import { type Buildable, resolveBuildable } from '@/artifacts/shared/buildable'
import type { RendererRegistry, ArtifactResolver } from '@/rendering'
import { assembleBundle, type BundleAssemblyOptions, type AssembledBundle } from '@/rendering'

// Import artifacts runtime types for content
import type { RuntimeDocument, DraftDocument } from '../document'
import type { RuntimeChecklist, DraftChecklist } from '../checklist'
import type { RuntimeForm, DraftForm, SignableForm } from '../form'

// ============================================================================
// Types
// ============================================================================

/**
 * Bundle input type for direct creation (kind is optional)
 */
export type BundleInput = Omit<Bundle, 'kind'> & { kind?: 'bundle' }

/**
 * RuntimeBundle JSON representation (union of all phases)
 */
export type RuntimeBundleJSON<B extends Bundle> = DraftBundleJSON<B> | SignableBundleJSON<B> | ExecutedBundleJSON<B>

/**
 * A runtime content instance that can be part of a bundle.
 */
export type RuntimeInstance =
	| RuntimeForm<Form>
	| RuntimeChecklist<Checklist>
	| RuntimeDocument<Document>
	| RuntimeBundle<Bundle>

/**
 * Content map for RuntimeBundle.
 * Keys are content keys from the bundle definition, values are runtime instances.
 */
export type RuntimeBundleContents = Record<string, RuntimeInstance>

/**
 * Options for rendering a RuntimeBundle.
 */
export interface RuntimeBundleRenderOptions {
	/** Resolver for file-based layers (optional if all layers are inline) */
	resolver?: Resolver | ArtifactResolver
	/** Renderers keyed by MIME type */
	renderers: RendererRegistry
}

/**
 * Output from a single rendered content item.
 */
export interface RuntimeBundleRenderedOutput {
	/** The rendered content (binary) */
	content: BinaryContent
	/** The MIME type of the rendered content */
	mimeType: string
	/** Suggested filename with extension */
	filename: string
}

/**
 * Result of rendering a RuntimeBundle.
 */
export interface RuntimeBundleRendered<B extends Bundle> {
	/** The original bundle */
	bundle: B
	/** Rendered outputs keyed by content key */
	outputs: Record<string, RuntimeBundleRenderedOutput>
	/** Execution timestamp (for executed phase) */
	executedAt?: string
}

/**
 * BundleInstance - design-time wrapper for Bundle artifacts
 */
export interface BundleInstance<B extends Bundle> extends ArtifactMethods<B> {
	/** Bundle defs section */
	readonly defs: B extends { defs: infer L } ? L : DefsSection | undefined

	/** Bundle contents array */
	readonly contents: B extends { contents: infer C } ? C : BundleContentItem[]

	/**
	 * Assemble this bundle by rendering filled instances with their target layers.
	 *
	 * This method accepts runtime instances (RuntimeForm, RuntimeChecklist, RuntimeDocument)
	 * and renders them using the appropriate renderer based on each layer's MIME type.
	 */
	assemble(options: BundleAssemblyOptions): Promise<AssembledBundle>

	/**
	 * Prepare this bundle with runtime content instances.
	 *
	 * Creates a RuntimeBundle in draft phase that encapsulates the bundle definition
	 * together with all its content instances.
	 *
	 * @param contents - Runtime instances keyed by bundle content key (optional, defaults to empty)
	 * @returns A DraftBundle ready for further mutation or signing
	 */
	prepare(contents?: RuntimeBundleContents): DraftBundle<B>

	/**
	 * Create an exact copy of this instance.
	 */
	clone(): BundleInstance<B>
}

/**
 * RuntimeBundle - unified draft/signable/executed lifecycle object
 */
// ============================================================================
// Phase-Specific Interfaces (Discriminated Union)
// ============================================================================

/**
 * Base interface with shared read-only properties and methods (all phases)
 */
interface RuntimeBundleBase<B extends Bundle> {
	/** Embedded bundle definition */
	readonly bundle: B

	// Convenience getters
	readonly name: string
	readonly version: string | undefined
	readonly title: string | undefined
	readonly description: string | undefined

	// Content Access Methods
	getContentKeys(): string[]
	getContent(key: string): RuntimeInstance | undefined
	hasContent(key: string): boolean
	getAllContents(): RuntimeBundleContents

	// Rendering
	render(options: RuntimeBundleRenderOptions): Promise<RuntimeBundleRendered<B>>

	// Serialization
	toJSON(): RuntimeBundleJSON<B>
	toYAML(): string
}

/**
 * Draft phase - can add/remove/update content, prepare for signing
 */
export interface DraftBundle<B extends Bundle> extends RuntimeBundleBase<B> {
	/** Phase discriminator */
	readonly phase: 'draft'

	/** No execution timestamp in draft */
	readonly executedAt: undefined

	// Content Mutation Methods
	setContent(key: string, instance: RuntimeInstance): DraftBundle<B>
	removeContent(key: string): DraftBundle<B>
	updateContents(contents: RuntimeBundleContents): DraftBundle<B>

	// Phase Transition (draft → signable)
	prepareForSigning(): SignableBundle<B>

	// Clone
	clone(): DraftBundle<B>
}

/**
 * Signable phase - can update content (for signature capture), finalize
 */
export interface SignableBundle<B extends Bundle> extends RuntimeBundleBase<B> {
	/** Phase discriminator */
	readonly phase: 'signable'

	/** No execution timestamp in signable */
	readonly executedAt: undefined

	// Content Update Method (for signature capture on forms)
	updateContent(key: string, instance: RuntimeInstance): SignableBundle<B>

	// Phase Transition (signable → executed)
	finalize(): ExecutedBundle<B>

	// Clone
	clone(): SignableBundle<B>
}

/**
 * Executed phase - immutable, read-only
 */
export interface ExecutedBundle<B extends Bundle> extends RuntimeBundleBase<B> {
	/** Phase discriminator */
	readonly phase: 'executed'

	/** Execution timestamp (always defined) */
	readonly executedAt: string

	// Clone
	clone(): ExecutedBundle<B>
}

/**
 * RuntimeBundle - discriminated union of all phases
 */
export type RuntimeBundle<B extends Bundle> = DraftBundle<B> | SignableBundle<B> | ExecutedBundle<B>

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get file extension for a MIME type.
 */
function getExtensionForMime(mimeType: string): string {
	const mimeToExt: Record<string, string> = {
		'text/markdown': 'md',
		'text/html': 'html',
		'text/plain': 'txt',
		'application/pdf': 'pdf',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
		'application/json': 'json',
		'text/yaml': 'yaml',
		'application/yaml': 'yaml',
	}
	return mimeToExt[mimeType] ?? 'bin'
}

/**
 * Serialize a runtime instance to RuntimeContentJSON format.
 */
function serializeInstance(instance: RuntimeInstance): RuntimeContentJSON {
	// Check for form (has 'form' property and either 'fields' or 'phase')
	if ('form' in instance && 'fields' in instance) {
		const json = (instance as RuntimeForm<Form>).toJSON()
		return {
			kind: 'form',
			artifact: json.form,
			targetLayer: json.targetLayer,
			data: {
				fields: json.fields,
				parties: json.parties,
				annexes: json.annexes,
				signers: json.signers,
				signatories: json.signatories,
				...('captures' in json && { captures: json.captures }),
				...('witnesses' in json && { witnesses: json.witnesses }),
				...('attestations' in json && { attestations: json.attestations }),
				...('executedAt' in json && { executedAt: json.executedAt }),
			},
			phase: json.phase,
		}
	}

	// Check for checklist (has 'checklist' property)
	if ('checklist' in instance) {
		const json = (instance as RuntimeChecklist<Checklist>).toJSON()
		return {
			kind: 'checklist',
			artifact: json.checklist,
			targetLayer: json.targetLayer,
			data: json.items,
			phase: json.phase,
		}
	}

	// Check for document (has 'document' property)
	if ('document' in instance) {
		const json = (instance as RuntimeDocument<Document>).toJSON()
		return {
			kind: 'document',
			artifact: json.document,
			targetLayer: json.targetLayer,
			phase: json.phase,
		}
	}

	// Check for nested bundle (has 'bundle' property)
	if ('bundle' in instance && instance.phase !== undefined) {
		const json = (instance as RuntimeBundle<Bundle>).toJSON()
		if (json.phase === 'executed') {
			return {
				kind: 'bundle',
				artifact: json.bundle,
				targetLayer: '',
				data: { contents: json.contents, executedAt: json.executedAt },
				phase: json.phase,
			}
		}
		return {
			kind: 'bundle',
			artifact: json.bundle,
			targetLayer: '',
			data: json.contents,
			phase: json.phase,
		}
	}

	throw new Error('Unknown runtime instance type')
}

/**
 * Serialize contents to RuntimeContentJSON format.
 */
function serializeContents(contents: RuntimeBundleContents): Record<string, RuntimeContentJSON> {
	const serialized: Record<string, RuntimeContentJSON> = {}
	for (const [key, instance] of Object.entries(contents)) {
		serialized[key] = serializeInstance(instance)
	}
	return serialized
}

/**
 * Get layers and target layer from a runtime instance.
 */
function getInstanceLayerInfo(instance: RuntimeInstance): { layers: Record<string, Layer>; targetLayer: string } {
	if ('form' in instance && 'fields' in instance) {
		const form = (instance as RuntimeForm<Form>).form
		return {
			layers: form.layers ?? {},
			targetLayer: (instance as RuntimeForm<Form>).targetLayer,
		}
	}

	if ('checklist' in instance) {
		const checklist = (instance as RuntimeChecklist<Checklist>).checklist
		return {
			layers: checklist.layers ?? {},
			targetLayer: (instance as RuntimeChecklist<Checklist>).targetLayer,
		}
	}

	if ('document' in instance) {
		const document = (instance as RuntimeDocument<Document>).document
		return {
			layers: document.layers ?? {},
			targetLayer: (instance as RuntimeDocument<Document>).targetLayer,
		}
	}

	// Bundles don't have layers
	return { layers: {}, targetLayer: '' }
}

// ============================================================================
// RuntimeBundle Factory
// ============================================================================

interface RuntimeBundleConfig<B extends Bundle> {
	bundle: B
	contents: RuntimeBundleContents
	phase: 'draft' | 'signable' | 'executed'
	executedAt?: string
}

/**
 * Creates a RuntimeBundle object (replaces DraftBundle, SignableBundle, ExecutedBundle classes)
 */
function createRuntimeBundle<B extends Bundle>(config: RuntimeBundleConfig<B>): RuntimeBundle<B> {
	const { bundle: bundleDef, contents: contentValues, phase, executedAt } = config

	// Build content keys set from bundle definition
	const bundleContentKeys = new Set(bundleDef.contents.map((c) => c.key))

	const ensureDraft = (operation: string): void => {
		if (phase !== 'draft') {
			throw new Error(`Cannot ${operation}: bundle is in ${phase} phase (only draft phase allows this)`)
		}
	}

	const ensureSignable = (operation: string): void => {
		if (phase !== 'signable') {
			throw new Error(`Cannot ${operation}: bundle is in ${phase} phase (only signable phase allows this)`)
		}
	}

	const ensureNotExecuted = (operation: string): void => {
		if (phase === 'executed') {
			throw new Error(`Cannot ${operation}: bundle is in executed phase (read-only)`)
		}
	}

	const validateContentKey = (key: string): void => {
		if (!bundleContentKeys.has(key)) {
			throw new Error(
				`Content key "${key}" not found in bundle definition. ` +
					`Available keys: ${Array.from(bundleContentKeys).join(', ')}`
			)
		}
	}

	const runtime = {
		phase,
		bundle: bundleDef,
		executedAt,

		// Convenience getters
		get name() {
			return bundleDef.name
		},
		get version() {
			return bundleDef.version
		},
		get title() {
			return bundleDef.title
		},
		get description() {
			return bundleDef.description
		},

		// ============================================================================
		// Content Access Methods
		// ============================================================================

		getContentKeys(): string[] {
			return Object.keys(contentValues)
		},

		getContent(key: string): RuntimeInstance | undefined {
			return contentValues[key]
		},

		hasContent(key: string): boolean {
			return key in contentValues
		},

		getAllContents(): RuntimeBundleContents {
			return { ...contentValues }
		},

		// ============================================================================
		// Content Mutation Methods (draft only)
		// ============================================================================

		setContent(key: string, instance: RuntimeInstance): RuntimeBundle<B> {
			ensureDraft('setContent')
			validateContentKey(key)

			return createRuntimeBundle({
				...config,
				contents: { ...contentValues, [key]: instance },
			})
		},

		removeContent(key: string): RuntimeBundle<B> {
			ensureDraft('removeContent')

			if (!(key in contentValues)) {
				throw new Error(
					`Content key "${key}" not found in current contents. ` +
						`Available keys: ${Object.keys(contentValues).join(', ')}`
				)
			}

			const newContents = { ...contentValues }
			delete newContents[key]

			return createRuntimeBundle({
				...config,
				contents: newContents,
			})
		},

		updateContents(contents: RuntimeBundleContents): RuntimeBundle<B> {
			ensureDraft('updateContents')

			// Validate all keys
			for (const key of Object.keys(contents)) {
				validateContentKey(key)
			}

			return createRuntimeBundle({
				...config,
				contents: { ...contentValues, ...contents },
			})
		},

		// ============================================================================
		// Content Update Methods (signable phase)
		// ============================================================================

		updateContent(key: string, instance: RuntimeInstance): RuntimeBundle<B> {
			ensureNotExecuted('updateContent')

			if (!(key in contentValues)) {
				throw new Error(
					`Content key "${key}" not found. Cannot add new content in ${phase} phase. ` +
						`Available keys: ${Object.keys(contentValues).join(', ')}`
				)
			}

			return createRuntimeBundle({
				...config,
				contents: { ...contentValues, [key]: instance },
			})
		},

		// ============================================================================
		// Phase Transitions
		// ============================================================================

		prepareForSigning(): RuntimeBundle<B> {
			ensureDraft('prepareForSigning')

			// Transition all content instances to signable/completed/final
			const signableContents: RuntimeBundleContents = {}

			for (const [key, instance] of Object.entries(contentValues)) {
				signableContents[key] = transitionToSignable(instance)
			}

			return createRuntimeBundle({
				bundle: bundleDef,
				contents: signableContents,
				phase: 'signable',
			})
		},

		finalize(): RuntimeBundle<B> {
			ensureSignable('finalize')

			// Transition all content instances to executed
			const executedContents: RuntimeBundleContents = {}

			for (const [key, instance] of Object.entries(contentValues)) {
				executedContents[key] = transitionToExecuted(instance)
			}

			return createRuntimeBundle({
				bundle: bundleDef,
				contents: executedContents,
				phase: 'executed',
				executedAt: new Date().toISOString(),
			})
		},

		// ============================================================================
		// Rendering
		// ============================================================================

		async render(options: RuntimeBundleRenderOptions): Promise<RuntimeBundleRendered<B>> {
			const { resolver, renderers } = options
			const outputs: Record<string, RuntimeBundleRenderedOutput> = {}

			for (const [key, instance] of Object.entries(contentValues)) {
				const output = await renderInstance(key, instance, { resolver, renderers })
				outputs[key] = output
			}

			return {
				bundle: bundleDef,
				outputs,
				...(executedAt && { executedAt }),
			}
		},

		// ============================================================================
		// Serialization
		// ============================================================================

		toJSON(): RuntimeBundleJSON<B> {
			const serializedContents = serializeContents(contentValues)

			if (phase === 'draft') {
				return {
					phase: 'draft',
					bundle: bundleDef,
					contents: serializedContents,
				}
			}

			if (phase === 'signable') {
				return {
					phase: 'signable',
					bundle: bundleDef,
					contents: serializedContents,
				}
			}

			return {
				phase: 'executed',
				bundle: bundleDef,
				contents: serializedContents,
				executedAt: executedAt!,
			}
		},

		toYAML(): string {
			return toYAML(runtime.toJSON())
		},

		clone() {
			return createRuntimeBundle({
				bundle: structuredClone(bundleDef),
				contents: cloneContents(contentValues),
				phase,
				executedAt,
			})
		},
	}

	// Cast to RuntimeBundle<B> - the discriminated union phases will narrow this appropriately for consumers
	return runtime as unknown as RuntimeBundle<B>
}

/**
 * Clone all contents by calling clone() on each instance.
 */
function cloneContents(contents: RuntimeBundleContents): RuntimeBundleContents {
	const cloned: RuntimeBundleContents = {}
	for (const [key, instance] of Object.entries(contents)) {
		cloned[key] = instance.clone()
	}
	return cloned
}

/**
 * Transition a draft instance to signable/completed/final phase.
 */
function transitionToSignable(instance: RuntimeInstance): RuntimeInstance {
	// Form: draft → signable
	if ('form' in instance && instance.phase === 'draft') {
		return (instance as DraftForm<Form>).prepareForSigning()
	}

	// Checklist: draft → completed
	if ('checklist' in instance && instance.phase === 'draft') {
		return (instance as DraftChecklist<Checklist>).complete()
	}

	// Document: draft → final
	if ('document' in instance && instance.phase === 'draft') {
		return (instance as DraftDocument<Document>).finalize()
	}

	// Nested bundle: draft → signable
	if ('bundle' in instance && instance.phase === 'draft') {
		return (instance as DraftBundle<Bundle>).prepareForSigning()
	}

	throw new Error('Unknown instance type for phase transition')
}

/**
 * Transition a signable instance to executed phase.
 */
function transitionToExecuted(instance: RuntimeInstance): RuntimeInstance {
	// Form: signable → executed
	if ('form' in instance && instance.phase === 'signable') {
		return (instance as SignableForm<Form>).finalize()
	}

	// Checklist: already completed, stays as is
	if ('checklist' in instance) {
		return instance
	}

	// Document: already final, stays as is
	if ('document' in instance) {
		return instance
	}

	// Nested bundle: signable → executed
	if ('bundle' in instance && instance.phase === 'signable') {
		return (instance as SignableBundle<Bundle>).finalize()
	}

	throw new Error('Unknown instance type for phase transition')
}

/**
 * Render a single runtime instance.
 */
async function renderInstance(
	key: string,
	instance: RuntimeInstance,
	options: { resolver?: Resolver | ArtifactResolver; renderers: RendererRegistry }
): Promise<RuntimeBundleRenderedOutput> {
	const { resolver, renderers } = options

	const { layers, targetLayer } = getInstanceLayerInfo(instance)

	// Handle nested bundles (no direct layer rendering)
	if ('bundle' in instance && instance.phase !== undefined) {
		const nestedResult = await (instance as RuntimeBundle<Bundle>).render({ resolver, renderers })
		const firstKey = Object.keys(nestedResult.outputs)[0]
		if (firstKey && nestedResult.outputs[firstKey]) {
			return nestedResult.outputs[firstKey]!
		}
		throw new Error('Nested bundle has no contents')
	}

	const layer = layers[targetLayer]
	if (!layer) {
		throw new Error(`Layer "${targetLayer}" not found for content "${key}"`)
	}

	const mimeType = layer.mimeType
	const renderer = renderers[mimeType]

	if (!renderer) {
		throw new Error(
			`No renderer for MIME type "${mimeType}". ` + `Registered renderers: ${Object.keys(renderers).join(', ')}`
		)
	}

	// Render based on instance type
	let content: unknown

	if ('form' in instance && 'fields' in instance) {
		content = await (instance as RuntimeForm<Form>).render({ renderer, resolver, layer: targetLayer })
	} else if ('checklist' in instance) {
		content = await (instance as RuntimeChecklist<Checklist>).render({ resolver, layer: targetLayer })
	} else if ('document' in instance) {
		content = await (instance as RuntimeDocument<Document>).render({ resolver, layer: targetLayer })
	} else {
		throw new Error('Unknown instance type')
	}

	// Convert to binary
	const binaryContent: BinaryContent =
		typeof content === 'string' ? new TextEncoder().encode(content) : (content as BinaryContent)

	return {
		content: binaryContent,
		mimeType,
		filename: `${key}.${getExtensionForMime(mimeType)}`,
	}
}

/**
 * Load a RuntimeBundle from JSON
 */
export function runtimeBundleFromJSON<B extends Bundle>(
	json: RuntimeBundleJSON<B>,
	deserializeContent: (content: RuntimeContentJSON) => RuntimeInstance
): RuntimeBundle<B> {
	// Deserialize contents
	const contents: RuntimeBundleContents = {}
	for (const [key, contentJson] of Object.entries(json.contents)) {
		contents[key] = deserializeContent(contentJson)
	}

	return createRuntimeBundle({
		bundle: json.bundle,
		contents,
		phase: json.phase,
		executedAt: 'executedAt' in json ? json.executedAt : undefined,
	})
}

// ============================================================================
// BundleInstance Factory
// ============================================================================

/**
 * Creates a BundleInstance object (replaces BundleInstance class)
 */
function createBundleInstance<B extends Bundle>(bundleDef: B): BundleInstance<B> {
	const artifactMethods = withArtifactMethods(bundleDef)

	const instance: BundleInstance<B> = {
		...artifactMethods,

		// Bundle-specific properties (type assertions needed for conditional types)
		defs: bundleDef.defs as BundleInstance<B>['defs'],
		contents: bundleDef.contents as BundleInstance<B>['contents'],

		async assemble(options: BundleAssemblyOptions): Promise<AssembledBundle> {
			return assembleBundle(bundleDef, options)
		},

		prepare(contents: RuntimeBundleContents = {}): DraftBundle<B> {
			// Validate all content keys exist in bundle
			const bundleContentKeys = new Set(bundleDef.contents.map((c) => c.key))
			for (const key of Object.keys(contents)) {
				if (!bundleContentKeys.has(key)) {
					throw new Error(
						`Content key "${key}" not found in bundle. ` +
							`Available keys: ${Array.from(bundleContentKeys).join(', ')}`
					)
				}
			}

			return createRuntimeBundle({
				bundle: bundleDef,
				contents,
				phase: 'draft',
			}) as DraftBundle<B>
		},

		clone(): BundleInstance<B> {
			return createBundleInstance(structuredClone(bundleDef))
		},
	}

	return instance
}

// ============================================================================
// BundleBuilder
// ============================================================================

export interface BundleBuilderInterface {
	from(bundleValue: Bundle): BundleBuilderInterface
	name(value: string): BundleBuilderInterface
	version(value?: string): BundleBuilderInterface
	title(value?: string): BundleBuilderInterface
	description(value: string): BundleBuilderInterface
	code(value: string): BundleBuilderInterface
	releaseDate(value: string): BundleBuilderInterface
	metadata(value: Metadata): BundleBuilderInterface
	instructions(value: ContentRef): BundleBuilderInterface
	agentInstructions(value: ContentRef): BundleBuilderInterface
	defs(defsDef: DefsSection): BundleBuilderInterface
	def(name: string, expression: string | Expression): BundleBuilderInterface
	registry(key: string, slug: string, include?: CondExpr): BundleBuilderInterface
	path(key: string, pathValue: string, include?: CondExpr): BundleBuilderInterface
	inline(key: string, artifact: Buildable<Document | Form | Checklist | Bundle>, include?: CondExpr): BundleBuilderInterface
	contents(contentsArray: BundleContentItem[]): BundleBuilderInterface
	removeContent(predicate: (content: BundleContentItem, index: number) => boolean): BundleBuilderInterface
	clearContents(): BundleBuilderInterface
	build(): BundleInstance<Bundle>
}

/**
 * Creates a BundleBuilder (closure-based)
 */
function createBundleBuilder(): BundleBuilderInterface {
	const _def: Record<string, unknown> = {
		kind: 'bundle',
		name: '',
		version: undefined,
		title: undefined,
		description: undefined,
		code: undefined,
		releaseDate: undefined,
		metadata: {},
		instructions: undefined,
		agentInstructions: undefined,
		defs: undefined,
		contents: [],
	}

	const builder: BundleBuilderInterface = {
		from(bundleValue: Bundle) {
			const parsed = parseBundleSchema(bundleValue)
			_def.kind = 'bundle'
			_def.name = parsed.name
			_def.version = parsed.version
			_def.title = parsed.title
			_def.description = parsed.description
			_def.code = parsed.code
			_def.releaseDate = parsed.releaseDate
			_def.metadata = parsed.metadata ? { ...parsed.metadata } : {}
			_def.instructions = parsed.instructions
			_def.agentInstructions = parsed.agentInstructions
			_def.defs = parsed.defs ? { ...parsed.defs } : undefined
			_def.contents = parsed.contents.map((content) => parseBundleContentItem(content))
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

		defs(defsDef: DefsSection) {
			_def.defs = defsDef
			return builder
		},

		def(name: string, expression: string | Expression) {
			const defs = (_def.defs as DefsSection) || {}
			if (typeof expression === 'string') {
				defs[name] = { type: 'boolean', value: expression }
			} else {
				defs[name] = expression
			}
			_def.defs = defs
			return builder
		},

		registry(key: string, slug: string, include?: CondExpr) {
			const contents = (_def.contents as BundleContentItem[]) || []
			const item: BundleContentItem = { type: 'registry', key, slug }
			if (include !== undefined) {
				;(item as { type: 'registry'; key: string; slug: string; include?: CondExpr }).include = include
			}
			contents.push(parseBundleContentItem(item) as BundleContentItem)
			_def.contents = contents
			return builder
		},

		path(key: string, pathValue: string, include?: CondExpr) {
			const contents = (_def.contents as BundleContentItem[]) || []
			const item: BundleContentItem = { type: 'path', key, path: pathValue }
			if (include !== undefined) {
				;(item as { type: 'path'; key: string; path: string; include?: CondExpr }).include = include
			}
			contents.push(parseBundleContentItem(item) as BundleContentItem)
			_def.contents = contents
			return builder
		},

		inline(key: string, artifact: Buildable<Document | Form | Checklist | Bundle>, _include?: CondExpr) {
			const contents = (_def.contents as BundleContentItem[]) || []
			const resolvedArtifact = resolveBuildable(artifact)
			// Extract raw artifact data if it's an instance (has _data property)
			// This ensures we store plain data without methods for structuredClone compatibility
			const rawArtifact = '_data' in resolvedArtifact
				? (resolvedArtifact as { _data: Document | Form | Checklist | Bundle })._data
				: resolvedArtifact
			const item: BundleContentItem = { type: 'inline', key, artifact: rawArtifact }
			contents.push(parseBundleContentItem(item) as BundleContentItem)
			_def.contents = contents
			return builder
		},

		contents(contentsArray: BundleContentItem[]) {
			const parsed: BundleContentItem[] = []
			for (const contentDef of contentsArray) {
				parsed.push(parseBundleContentItem(contentDef as unknown) as BundleContentItem)
			}
			_def.contents = parsed
			return builder
		},

		removeContent(predicate: (content: BundleContentItem, index: number) => boolean) {
			const contents = (_def.contents as BundleContentItem[]) || []
			_def.contents = contents.filter((content, index) => !predicate(content, index))
			return builder
		},

		clearContents() {
			_def.contents = []
			return builder
		},

		build(): BundleInstance<Bundle> {
			const payload = Object.fromEntries(Object.entries(_def).filter(([, value]) => value !== undefined))
			const result = parseBundleSchema(payload as unknown) as Bundle
			return createBundleInstance(result)
		},
	}

	return builder
}

// ============================================================================
// Bundle API
// ============================================================================

type BundleAPI = {
	(): BundleBuilderInterface
	<const T extends BundleInput>(input: T): BundleInstance<T & { kind: 'bundle' }>
	from(input: unknown): BundleInstance<Bundle>
	safeFrom(input: unknown): { success: true; data: BundleInstance<Bundle> } | { success: false; error: Error }
}

function bundleImpl(): BundleBuilderInterface
function bundleImpl<const T extends BundleInput>(input: T): BundleInstance<T & { kind: 'bundle' }>
function bundleImpl<const T extends BundleInput>(input?: T): BundleBuilderInterface | BundleInstance<T & { kind: 'bundle' }> {
	if (input !== undefined) {
		const withKind = { ...input, kind: 'bundle' as const }
		const parsed = parseBundleSchema(withKind) as T & { kind: 'bundle' }
		return createBundleInstance(parsed)
	}
	return createBundleBuilder()
}

export const bundle: BundleAPI = Object.assign(bundleImpl, {
	from: (input: unknown): BundleInstance<Bundle> => {
		const parsed = parseBundleSchema(input) as Bundle
		return createBundleInstance(parsed)
	},
	safeFrom: (input: unknown): { success: true; data: BundleInstance<Bundle> } | { success: false; error: Error } => {
		try {
			const parsed = parseBundleSchema(input) as Bundle
			return { success: true, data: createBundleInstance(parsed) }
		} catch (err) {
			return { success: false, error: err as Error }
		}
	},
})
