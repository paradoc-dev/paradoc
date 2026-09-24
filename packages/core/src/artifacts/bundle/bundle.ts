/**
 * Bundle Artifact - Closure-based implementation
 *
 * BundleInstance, DraftBundle, SignableBundle, and ExecutedBundle, in a
 * single file using closures and composition.
 */

import type {
	Bundle,
	BundleContentItem,
	Document,
	Form,
	Checklist,
	Formatter,
	FormatterProgressivePolicy,
	Metadata,
	DefsSection,
	Expression,
	CondExpr,
	RuntimeContentJSON,
	ContentRef,
	BundlePhase,
	RuntimeBundleJSON,
	RuntimeChecklistJSON,
	RuntimeContext,
	RuntimeDocumentJSON,
	RuntimeFormJSON,
} from '@paradoc/types'
import {
	parseBundle as parseBundleSchema,
	parseBundleContentItem,
} from '@/validation/artifact-parsers'
import { toYAML } from '@/serialization/serialization'
import {
	assertValidArtifactDefinition,
	snapshotArtifactDefinition,
	withArtifactMethods,
	type ArtifactMethods,
} from '../shared/artifact-methods'
import { type Buildable, resolveBuildable } from '@/artifacts/shared/buildable'
import type { RendererRegistry } from '@/rendering'
import { assembleBundle, type BundleAssemblyOptions, type AssembledBundle } from '@/rendering'
import { renderBundlePart, type BundlePartOutput } from '@/rendering/bundle-part'
import {
	captureRuntimeContext,
	restoreRuntimeContext,
	type RuntimeCreationOptions,
} from '../shared/runtime-context'
import type { ArtifactInstanceOptions } from '../shared/render-layer'

// Import artifacts runtime types for content
import { runtimeDocumentFromJSON, type RuntimeDocument, type DraftDocument } from '../document'
import { runtimeChecklistFromJSON, type RuntimeChecklist, type DraftChecklist } from '../checklist'
import { runtimeFormFromJSON, type RuntimeForm, type DraftForm, type SignableForm } from '../form'
import type { DeepMutable, DeepReadonly } from '@/artifacts/shared/definition-types'
import {
	assertBundleInclusionResolved,
	decisionForKey,
	evaluateBundleInclusion,
	includedRuntimeContents,
	type BundleInclusionDecision,
	type BundleInclusionState,
} from './inclusion'

// ============================================================================
// Types
// ============================================================================

/**
 * Bundle input type for direct creation (kind is optional)
 */
export type BundleInput = DeepReadonly<Omit<Bundle, 'kind'>> & { readonly kind?: 'bundle' }

type MutableBundle<T extends BundleInput> = DeepMutable<T> & Bundle & { kind: 'bundle' }

type BundleArtifact = Document | Form | Checklist | Bundle
type BundleArtifactInput = Buildable<BundleArtifact> | { readonly _data: BundleArtifact }

export type { RuntimeBundleJSON }

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
	/**
	 * Optional custom renderers keyed by MIME type. Supported layers render
	 * automatically.
	 *
	 * There is no resolver here: a bundle's parts are artifact instances that
	 * each carry the resolver bound when they were constructed.
	 */
	renderers?: RendererRegistry
	/** Formatter policy applied to each included artifact render. */
	formatter?: Formatter
	/** Explicit missing/incomplete value policy for progressive previews. */
	progressive?: FormatterProgressivePolicy
}

/** Output from a single rendered content item. */
export type RuntimeBundleRenderedOutput = BundlePartOutput

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
	 * The bundle captures one clock here (`options.context.asOf`, or the
	 * current instant). Include conditions that read `today()` or `now()` use
	 * it, whatever instant each member was filled at.
	 *
	 * @param contents - Runtime instances keyed by bundle content key (optional, defaults to empty)
	 * @param options - The clock the bundle captures
	 * @returns A DraftBundle ready for further mutation or signing
	 */
	prepare(contents?: RuntimeBundleContents, options?: RuntimeCreationOptions): DraftBundle<B>

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

	/** The clock captured when the bundle was prepared, which inclusion reads. */
	readonly context: RuntimeContext

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

	/** Inspect membership conditions against the contents currently supplied. */
	getInclusionState(): BundleInclusionState
	/** Inspect one member's inclusion decision. */
	getInclusion(key: string): BundleInclusionDecision
	/** Return the supplied runtime contents that are included in output. */
	getIncludedContents(): RuntimeBundleContents

	// Rendering
	render(options?: RuntimeBundleRenderOptions): Promise<RuntimeBundleRendered<B>>

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
			context: json.context,
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
			context: json.context,
			data: json.items,
			phase: json.phase,
			...('completedAt' in json && { completedAt: json.completedAt }),
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
			...('finalizedAt' in json && { finalizedAt: json.finalizedAt }),
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
				context: json.context,
				data: { contents: json.contents, executedAt: json.executedAt },
				phase: json.phase,
			}
		}
		return {
			kind: 'bundle',
			artifact: json.bundle,
			targetLayer: '',
			context: json.context,
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

// ============================================================================
// RuntimeBundle Factory
// ============================================================================

interface RuntimeBundleConfig<B extends Bundle> {
	bundle: B
	contents: RuntimeBundleContents
	phase: BundlePhase
	context: RuntimeContext
	executedAt?: string
}

/**
 * Creates a RuntimeBundle object (replaces DraftBundle, SignableBundle, ExecutedBundle classes)
 */
function createRuntimeBundle<B extends Bundle>(config: RuntimeBundleConfig<B>): RuntimeBundle<B> {
	const { bundle: bundleDef, contents: contentValues, phase, context, executedAt } = config
	assertValidArtifactDefinition(bundleDef)

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

	const bundleItemsByKey = new Map(bundleDef.contents.map((c) => [c.key, c]))

	/**
	 * Reject an instance whose kind does not match the content declared or
	 * already held under `key`, or whose phase does not match what this
	 * bundle's phase requires for that kind.
	 */
	const validateContentInstance = (operation: string, key: string, instance: RuntimeInstance): void => {
		const kind = instanceKind(instance)
		if (!kind) {
			throw new Error(
				`Cannot ${operation}: content "${key}" is not a form, checklist, document, or bundle instance`
			)
		}

		const item = bundleItemsByKey.get(key)
		const existing = contentValues[key]
		const expectedKind =
			item?.type === 'inline' ? item.artifact.kind : existing ? instanceKind(existing) : undefined
		if (expectedKind && kind !== expectedKind) {
			throw new Error(`Cannot ${operation}: content "${key}" must be a ${expectedKind} instance, got a ${kind}`)
		}

		// A replacement keeps the phase of the member it replaces: an excluded
		// member stays a draft in a signable bundle. assertContentsFitPhase
		// then checks the resulting bundle as a whole.
		const requiredPhase = phase === 'draft' ? 'draft' : (existing?.phase ?? requiredContentPhase(phase, kind))
		if (instance.phase !== requiredPhase) {
			throw new Error(
				`Cannot ${operation}: content "${key}" is a ${kind} in ${instance.phase} phase, ` +
					`but a ${phase} bundle requires ${requiredPhase} phase`
			)
		}
	}

	assertContentsFitPhase(bundleDef, contentValues, phase, context)

	const runtime = {
		phase,
		bundle: bundleDef,
		context,
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

		getInclusionState(): BundleInclusionState {
			return evaluateBundleInclusion(bundleDef, contentValues, context)
		},

		getInclusion(key: string): BundleInclusionDecision {
			return decisionForKey(runtime.getInclusionState(), key)
		},

		getIncludedContents(): RuntimeBundleContents {
			const state = runtime.getInclusionState()
			return includedRuntimeContents(state, contentValues)
		},

		// ============================================================================
		// Content Mutation Methods (draft only)
		// ============================================================================

		setContent(key: string, instance: RuntimeInstance): RuntimeBundle<B> {
			ensureDraft('setContent')
			validateContentKey(key)
			validateContentInstance('setContent', key, instance)

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

			for (const [key, instance] of Object.entries(contents)) {
				validateContentKey(key)
				validateContentInstance('updateContents', key, instance)
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
			validateContentKey(key)

			if (!(key in contentValues)) {
				throw new Error(
					`Content key "${key}" not found. Cannot add new content in ${phase} phase. ` +
						`Available keys: ${Object.keys(contentValues).join(', ')}`
				)
			}
			validateContentInstance('updateContent', key, instance)

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
			const state = runtime.getInclusionState()
			assertSignableContents(state, contentValues)

			// Included members move to signable/completed/final. Excluded members
			// stay drafts, so reinclusion still restores their answers and an
			// incomplete excluded member never blocks signing.
			const included = new Set(state.includedKeys)
			const signableContents: RuntimeBundleContents = {}
			for (const [key, instance] of Object.entries(contentValues)) {
				signableContents[key] = included.has(key) ? transitionToSignable(instance) : instance
			}

			return createRuntimeBundle({
				bundle: bundleDef,
				contents: signableContents,
				phase: 'signable',
				context,
			})
		},

		finalize(): RuntimeBundle<B> {
			ensureSignable('finalize')
			const state = runtime.getInclusionState()
			assertSignableContents(state, contentValues)

			const included = new Set(state.includedKeys)
			const executedContents: RuntimeBundleContents = {}
			for (const [key, instance] of Object.entries(contentValues)) {
				executedContents[key] = included.has(key) ? transitionToExecuted(instance) : instance
			}

			return createRuntimeBundle({
				bundle: bundleDef,
				contents: executedContents,
				phase: 'executed',
				context,
				executedAt: new Date().toISOString(),
			})
		},

		// ============================================================================
		// Rendering
		// ============================================================================

		async render(options: RuntimeBundleRenderOptions = {}): Promise<RuntimeBundleRendered<B>> {
			const { renderers, formatter, progressive } = options
			const outputs: Record<string, RuntimeBundleRenderedOutput> = {}
			const included = runtime.getIncludedContents()

			for (const [key, instance] of Object.entries(included)) {
				Object.assign(outputs, await renderBundlePart(key, instance, { renderers, formatter, progressive }))
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
					context,
					contents: serializedContents,
				}
			}

			if (phase === 'signable') {
				return {
					phase: 'signable',
					bundle: bundleDef,
					context,
					contents: serializedContents,
				}
			}

			return {
				phase: 'executed',
				bundle: bundleDef,
				context,
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
				context: structuredClone(context),
				executedAt,
			})
		},
	}

	// Cast to RuntimeBundle<B> - the discriminated union phases will narrow this appropriately for consumers
	return runtime as unknown as RuntimeBundle<B>
}

type ContentKind = 'form' | 'checklist' | 'document' | 'bundle'

/**
 * Identify which artifact kind a runtime instance holds.
 */
function instanceKind(instance: RuntimeInstance): ContentKind | undefined {
	if ('form' in instance) return 'form'
	if ('checklist' in instance) return 'checklist'
	if ('document' in instance) return 'document'
	if ('bundle' in instance) return 'bundle'
	return undefined
}

/**
 * A bundle can sign or execute only when inclusion has resolved and every
 * included member has content.
 */
function assertSignableContents(state: BundleInclusionState, contents: RuntimeBundleContents): void {
	assertBundleInclusionResolved(state)
	const missing = state.includedKeys.filter((key) => !(key in contents))
	if (missing.length > 0) {
		const details = missing.map((key) => `Content "${key}" is included but has no content.`)
		throw new Error(`Cannot produce a completed bundle packet: ${details.join('; ')}`)
	}
}

/** The phase a bundle phase requires of an included member of each kind. */
function requiredContentPhase(bundlePhase: BundlePhase, kind: ContentKind): string {
	if (bundlePhase === 'draft') return 'draft'
	if (bundlePhase === 'signable') {
		return { form: 'signable', checklist: 'completed', document: 'final', bundle: 'signable' }[kind]
	}
	return { form: 'executed', checklist: 'completed', document: 'final', bundle: 'executed' }[kind]
}

/**
 * Check that every member fits the bundle, whether the bundle was prepared,
 * transitioned, mutated, or loaded from JSON: its key is declared, its kind is
 * the declared kind, and its phase is the one the bundle phase requires. Past
 * draft, inclusion must be resolved and every included member present; an
 * excluded member stays a draft.
 */
function assertContentsFitPhase(
	bundleDef: Bundle,
	contents: RuntimeBundleContents,
	phase: BundlePhase,
	context: RuntimeContext,
): void {
	const items = new Map(bundleDef.contents.map((item) => [item.key, item]))
	const problem = (key: string, detail: string): Error =>
		new Error(`Invalid ${phase} bundle "${bundleDef.name}": content "${key}" ${detail}`)

	for (const [key, instance] of Object.entries(contents)) {
		const item = items.get(key)
		if (!item) throw problem(key, `is not declared. Available keys: ${Array.from(items.keys()).join(', ')}`)
		const kind = instanceKind(instance)
		if (!kind) throw problem(key, 'is not a form, checklist, document, or bundle instance')
		if (item.type === 'inline' && item.artifact.kind !== kind) {
			throw problem(key, `must be a ${item.artifact.kind} instance, got a ${kind}`)
		}
	}
	if (phase === 'draft') {
		for (const [key, instance] of Object.entries(contents)) {
			if (instance.phase !== 'draft') throw problem(key, `is ${describeInstance(instance)}, but a draft bundle requires draft phase`)
		}
		return
	}

	const state = evaluateBundleInclusion(bundleDef, contents, context)
	assertSignableContents(state, contents)
	const included = new Set(state.includedKeys)
	for (const [key, instance] of Object.entries(contents)) {
		const required = included.has(key) ? requiredContentPhase(phase, instanceKind(instance)!) : 'draft'
		if (instance.phase !== required) {
			const role = included.has(key) ? 'an included' : 'an excluded'
			throw problem(key, `is ${describeInstance(instance)}, but ${role} member of a ${phase} bundle requires ${required} phase`)
		}
	}
}

/**
 * Describe an instance by kind and phase for a transition error.
 */
function describeInstance(instance: RuntimeInstance): string {
	const kind = instanceKind(instance)
	return kind ? `a ${kind} in ${instance.phase} phase` : 'an unrecognized instance'
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

	throw new Error(`Cannot prepare for signing: expected draft-phase content, got ${describeInstance(instance)}`)
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

	throw new Error(`Cannot finalize: expected signable-phase content, got ${describeInstance(instance)}`)
}

/**
 * Load one bundle member from its JSON, whatever its kind. A nested bundle
 * loads its own members the same way.
 *
 * A resolver is behavior, not data, so it is not in the JSON: bind it here to
 * give file-backed layers back.
 */
export function runtimeContentFromJSON(content: RuntimeContentJSON, options?: ArtifactInstanceOptions): RuntimeInstance {
	const { kind, artifact, targetLayer, context, phase } = content
	switch (kind) {
		case 'form':
			return runtimeFormFromJSON(
				{ ...(content.data as object), phase, form: artifact, targetLayer, context } as RuntimeFormJSON<Form>,
				options,
			)
		case 'checklist':
			return runtimeChecklistFromJSON(
				{
					phase,
					checklist: artifact,
					targetLayer,
					context,
					items: content.data,
					...(content.completedAt !== undefined && { completedAt: content.completedAt }),
				} as RuntimeChecklistJSON<Checklist>,
				options,
			)
		case 'document':
			return runtimeDocumentFromJSON(
				{
					phase,
					document: artifact,
					targetLayer,
					...(content.finalizedAt !== undefined && { finalizedAt: content.finalizedAt }),
				} as RuntimeDocumentJSON<Document>,
				options,
			)
		case 'bundle': {
			const executed = phase === 'executed'
			const data = content.data as { contents: Record<string, RuntimeContentJSON>; executedAt: string }
			return runtimeBundleFromJSON(
				{
					phase,
					bundle: artifact,
					context,
					contents: executed ? data.contents : content.data,
					...(executed && { executedAt: data.executedAt }),
				} as RuntimeBundleJSON<Bundle>,
				(member) => runtimeContentFromJSON(member, options),
			)
		}
		default:
			throw new Error(`Cannot load bundle content of kind "${String(kind)}"`)
	}
}

/**
 * Load a RuntimeBundle from JSON.
 *
 * Every member passes the same key, kind, and phase checks as a prepared
 * bundle, so a signable bundle cannot load with a draft included member or an
 * undeclared key. `deserializeContent` defaults to
 * {@link runtimeContentFromJSON}; pass one to bind a resolver.
 */
export function runtimeBundleFromJSON<B extends Bundle>(
	json: RuntimeBundleJSON<B>,
	deserializeContent: (content: RuntimeContentJSON) => RuntimeInstance = (content) => runtimeContentFromJSON(content),
): RuntimeBundle<B> {
	const contents: RuntimeBundleContents = {}
	for (const [key, contentJson] of Object.entries(json.contents)) {
		contents[key] = deserializeContent(contentJson)
	}

	return createRuntimeBundle({
		bundle: snapshotArtifactDefinition(json.bundle),
		contents,
		phase: json.phase,
		context: restoreRuntimeContext(json.context),
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
			assertValidArtifactDefinition(bundleDef)
			return assembleBundle(bundleDef, options)
		},

		prepare(contents: RuntimeBundleContents = {}, options?: RuntimeCreationOptions): DraftBundle<B> {
			assertValidArtifactDefinition(bundleDef)
			const empty = createRuntimeBundle({
				bundle: snapshotArtifactDefinition(bundleDef),
				contents: {},
				phase: 'draft',
				context: captureRuntimeContext(options),
			}) as DraftBundle<B>
			// Contents pass the same key, kind, and phase checks as updateContents.
			return empty.updateContents(contents)
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
	language(value: string): BundleBuilderInterface
	releaseDate(value: string): BundleBuilderInterface
	metadata(value: Metadata): BundleBuilderInterface
	instructions(value: ContentRef): BundleBuilderInterface
	agentInstructions(value: ContentRef): BundleBuilderInterface
	defs(defsDef: DefsSection): BundleBuilderInterface
	def(name: string, expression: string | Expression): BundleBuilderInterface
	registry(key: string, slug: string, include?: CondExpr): BundleBuilderInterface
	path(key: string, pathValue: string, include?: CondExpr): BundleBuilderInterface
	inline(key: string, artifact: BundleArtifactInput, include?: CondExpr): BundleBuilderInterface
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
		language: undefined,
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
			_def.language = parsed.language
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

		language(value: string) {
			_def.language = value
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

		inline(key: string, artifact: BundleArtifactInput, include?: CondExpr) {
			const contents = (_def.contents as BundleContentItem[]) || []
			const resolvedArtifact = resolveBuildable(artifact as Buildable<BundleArtifact>)
			// Extract raw artifact data if it's an instance (has _data property)
			// This ensures we store plain data without methods for structuredClone compatibility
			const rawArtifact = '_data' in resolvedArtifact
				? (resolvedArtifact as { _data: Document | Form | Checklist | Bundle })._data
				: resolvedArtifact
			const item: BundleContentItem = { type: 'inline', key, artifact: rawArtifact, ...(include !== undefined && { include }) }
			contents.push(parseBundleContentItem(item) as BundleContentItem)
			_def.contents = contents
			return builder
		},

		contents(contentsArray: BundleContentItem[]) {
			const parsed: BundleContentItem[] = []
			for (const contentDef of contentsArray) {
				if (contentDef.type === 'inline') {
					const resolvedArtifact = resolveBuildable(contentDef.artifact as Buildable<BundleArtifact>)
					const artifact = '_data' in resolvedArtifact
						? (resolvedArtifact as { _data: Document | Form | Checklist | Bundle })._data
						: resolvedArtifact
					parsed.push(parseBundleContentItem({ ...contentDef, artifact }) as BundleContentItem)
				} else {
					parsed.push(parseBundleContentItem(contentDef as unknown) as BundleContentItem)
				}
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
	<const T extends BundleInput>(input: T): BundleInstance<MutableBundle<T>>
	from(input: unknown): BundleInstance<Bundle>
	safeFrom(input: unknown): { success: true; data: BundleInstance<Bundle> } | { success: false; error: Error }
}

function bundleImpl(): BundleBuilderInterface
function bundleImpl<const T extends BundleInput>(input: T): BundleInstance<MutableBundle<T>>
function bundleImpl<const T extends BundleInput>(input?: T): BundleBuilderInterface | BundleInstance<MutableBundle<T>> {
	if (input !== undefined) {
		const withKind = { ...input, kind: 'bundle' as const }
		const parsed = parseBundleSchema(withKind) as MutableBundle<T>
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
