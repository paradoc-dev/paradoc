/**
 * Layer Rendering - Shared layer resolution and rendering logic
 *
 * This extracts the common render logic that was duplicated across
 * DocumentInstance, DraftDocument, and FinalDocument.
 */

import type { Form, FormData, Layer, ParadocRenderer, RendererLayer, Resolver } from '@paradoc/types'
import { renderLayer as createRenderer } from '@paradoc/render'
import {
	findRegisteredRenderer,
	InlineReactLayerError,
	isReactLayerMimeType,
	UnregisteredLayerRendererError,
	type RendererRegistry,
} from '@/rendering/renderer-registry'

/**
 * Runtime wiring bound to an artifact instance when it is constructed.
 *
 * A file-backed layer's bytes come from a resolver, and the resolver is bound
 * once: `para.form(schema, { resolver })`. Every instance derived from that
 * one — every fill, every mutator, every clone — carries it. There is no
 * per-call resolver, because a runtime artifact is immutable by
 * reconstruction: a mutator builds a fresh instance from the config, and a
 * resolver that arrived with a render call would not survive the next one.
 */
export interface ArtifactInstanceOptions {
	/** Reads the bytes of this artifact's file-backed layers. */
	resolver?: Resolver
}

/**
 * What an artifact instance's own `render` accepts. The resolver is not here:
 * it is bound at construction. See {@link ArtifactInstanceOptions}.
 */
export interface ArtifactLayerRenderOptions {
	/** Override the target layer for this render call. */
	layer?: string
	/**
	 * Renderers keyed by layer MIME type. A layer whose type has an entry
	 * renders through it instead of returning its raw content, which is how a
	 * format core does not ship — a React composition — reaches a render call
	 * that otherwise only resolves bytes.
	 */
	renderers?: RendererRegistry
}

/**
 * Options for the free `renderLayer` / `resolveAndRenderLayer` primitives,
 * which read a bare layers record rather than an artifact instance and so are
 * handed the resolver directly.
 */
export interface LayerRenderOptions extends ArtifactLayerRenderOptions {
	/** Reads the bytes of a file-backed layer. */
	resolver?: Resolver
}

/**
 * Where the missing resolver was meant to come from.
 *
 * `artifact` is a render or seal on an artifact instance, whose resolver is
 * bound at construction. `layers` is one of the free primitives below, which
 * read a bare layers record with no artifact to have bound anything, and so
 * are handed the resolver in their own options.
 */
export type ResolverBindingSite = 'artifact' | 'layers'

/** How each site says the resolver should have arrived. */
const REMEDY: Record<ResolverBindingSite, string> = {
	artifact:
		'no resolver is bound to this artifact. Bind one where the artifact is constructed, as the ' +
		'second argument to para.form, para.document or para.checklist, so every instance derived ' +
		'from it carries the resolver.',
	layers:
		'this call was given no resolver. `renderLayer` reads a bare layers record rather than an ' +
		'artifact, so there is nothing a resolver could have been bound to: pass one in its options.',
}

/**
 * A file-backed layer was rendered with no resolver to read its bytes.
 *
 * The remedy depends on where the render started, so `site` chooses it: an
 * artifact instance carries a resolver bound at construction, while the free
 * `renderLayer` primitive is handed one per call.
 */
export class UnboundResolverError extends Error {
	readonly layerKey: string
	readonly path: string
	readonly site: ResolverBindingSite

	constructor(layerKey: string, path: string, site: ResolverBindingSite) {
		super(`Layer "${layerKey}" is file-backed ("${path}") but ${REMEDY[site]}`)
		this.name = 'UnboundResolverError'
		this.layerKey = layerKey
		this.path = path
		this.site = site
	}
}

/**
 * Resolves the target layer key from available options.
 *
 * Priority:
 * 1. Explicit layer option
 * 2. Provided targetLayer
 * 3. Provided defaultLayer
 * 4. First available layer key
 *
 * @param layers - The layers record
 * @param targetLayer - Current target layer
 * @param defaultLayer - Default layer from artifact
 * @param options - Render options with optional layer override
 * @returns Resolved layer key
 * @throws Error if no layer can be resolved
 */
export function resolveLayerKey(
	layers: Record<string, Layer> | undefined,
	targetLayer: string | undefined,
	defaultLayer: string | undefined,
	options?: LayerRenderOptions,
): string {
	if (!layers || Object.keys(layers).length === 0) {
		throw new Error('No layers defined')
	}

	const key = options?.layer || targetLayer || defaultLayer || Object.keys(layers)[0]

	if (!key) {
		throw new Error(
			'No layer key provided and no defaultLayer set. ' +
				'Either pass a layer option or set defaultLayer on the artifact.',
		)
	}

	if (!layers[key]) {
		throw new Error(`Layer "${key}" not found. Available layers: ${Object.keys(layers).join(', ')}`)
	}

	return key
}

/**
 * What a renderer needs beyond the layer itself.
 *
 * An artifact that carries no field data still has to give a renderer an
 * artifact and a payload, so a caller with neither supplies a context standing
 * for it. `Document` does exactly that.
 */
export interface LayerRenderContext {
	form: Form
	data: FormData
}

/**
 * Renders one layer from a layers record.
 *
 * A layer whose MIME type has an entry in `renderers` renders through it and
 * the result is returned. Everything else resolves to content: an inline
 * layer's text, or the bytes a resolver reads for a file layer, decoded for
 * text-based types.
 *
 * A React layer has no content to resolve, so with nothing registered for it
 * this fails naming the layer and the option rather than handing back the
 * module's source.
 *
 * @throws {UnregisteredLayerRendererError} when a React layer has no renderer.
 */
export async function renderLayer(
	layers: Record<string, Layer> | undefined,
	layerKey: string,
	options?: LayerRenderOptions,
	context?: LayerRenderContext,
): Promise<string | Uint8Array> {
	return renderLayerAt(layers, layerKey, 'layers', options, context)
}

/**
 * The body of `renderLayer`, told which remedy a missing resolver should name.
 *
 * The site is not an option, because it is not the caller's to choose: it is
 * decided by which entry point was reached. Everything public here reads a
 * bare layers record and passes `layers`; an artifact rendering its own layer
 * reaches this through `resolveAndRenderArtifactLayer` and passes `artifact`.
 */
async function renderLayerAt(
	layers: Record<string, Layer> | undefined,
	layerKey: string,
	site: ResolverBindingSite,
	options?: LayerRenderOptions,
	context?: LayerRenderContext,
): Promise<string | Uint8Array> {
	if (!layers) {
		throw new Error('No layers defined')
	}

	const layerSpec = layers[layerKey]
	if (!layerSpec) {
		throw new Error(`Layer "${layerKey}" not found. Available layers: ${Object.keys(layers).join(', ')}`)
	}

	const registered = findRegisteredRenderer(options?.renderers, layerSpec.mimeType)
	if (registered) {
		if (!context) {
			throw new Error(
				`Layer "${layerKey}" has a registered renderer, but this render call supplies no artifact ` +
					'context for it. Render the layer through the artifact that declares it.',
			)
		}
		const template = await buildRendererLayer(layerKey, layerSpec, layerSpec.bindings, options?.resolver, site)
		return (await registered.render({
			template,
			form: context.form,
			data: context.data,
			bindings: layerSpec.bindings,
		})) as string | Uint8Array
	}

	// A React layer names a module rather than carrying content, so there is
	// nothing here to return: it renders through a renderer registered for it.
	if (isReactLayerMimeType(layerSpec.mimeType)) {
		throw new UnregisteredLayerRendererError(layerKey, layerSpec.mimeType)
	}

	// Handle inline layers - return embedded text directly
	if (layerSpec.kind === 'inline') {
		return layerSpec.text
	}

	// Handle file-backed layers - requires resolver
	if (layerSpec.kind === 'file') {
		if (!options?.resolver) {
			throw new UnboundResolverError(layerKey, layerSpec.path, site)
		}

		const bytes = await options.resolver.read(layerSpec.path)

		// Decode text-based mime types to string
		if (layerSpec.mimeType.startsWith('text/') || layerSpec.mimeType === 'application/json') {
			return new TextDecoder().decode(bytes)
		}

		return bytes
	}

	throw new Error(`Unknown layer kind: ${(layerSpec as { kind: string }).kind}`)
}

/**
 * Convenience function that resolves the layer key and renders in one call.
 *
 * @param layers - The layers record from the artifact
 * @param targetLayer - Current target layer
 * @param defaultLayer - Default layer from artifact
 * @param options - Render options
 * @returns Promise resolving to layer content
 */
export async function resolveAndRenderLayer(
	layers: Record<string, Layer> | undefined,
	targetLayer: string | undefined,
	defaultLayer: string | undefined,
	options?: LayerRenderOptions,
	context?: LayerRenderContext,
): Promise<string | Uint8Array> {
	const key = resolveLayerKey(layers, targetLayer, defaultLayer, options)
	return renderLayerAt(layers, key, 'layers', options, context)
}

/**
 * `resolveAndRenderLayer` for an artifact rendering its own layer.
 *
 * Not part of the package's public surface: it exists because a `Document`
 * resolves its layer through these primitives while carrying a resolver bound
 * at construction, so a missing one has to name the constructor rather than
 * these options. Forms and checklists reach `buildRendererLayer` directly and
 * name the site there.
 */
export async function resolveAndRenderArtifactLayer(
	layers: Record<string, Layer> | undefined,
	targetLayer: string | undefined,
	defaultLayer: string | undefined,
	options?: LayerRenderOptions,
	context?: LayerRenderContext,
): Promise<string | Uint8Array> {
	const key = resolveLayerKey(layers, targetLayer, defaultLayer, options)
	return renderLayerAt(layers, key, 'artifact', options, context)
}


// ============================================================================
// Renderer selection and template assembly
// ============================================================================

/**
 * Chooses the renderer for one layer.
 *
 * An explicit `renderer` override wins, then a renderer registered for the
 * layer's MIME type, then the built-in engines. A React layer has no built-in
 * engine — core would have to depend on React — so reaching the fallback with
 * one is an error naming the layer and how to register a renderer for it.
 *
 * @throws {UnregisteredLayerRendererError} when a React layer has no renderer.
 */
export function selectLayerRenderer<Output>(
	layerKey: string,
	layerSpec: Layer,
	override: ParadocRenderer<RendererLayer, Output> | undefined,
	registry: RendererRegistry | undefined,
): ParadocRenderer<RendererLayer, Output> {
	if (override) return override
	const registered = findRegisteredRenderer(registry, layerSpec.mimeType)
	if (registered) return registered as ParadocRenderer<RendererLayer, Output>
	if (isReactLayerMimeType(layerSpec.mimeType)) {
		throw new UnregisteredLayerRendererError(layerKey, layerSpec.mimeType)
	}
	// The built-in engines render `string | Uint8Array`; the call site's Output
	// is whatever the caller asked the renderer for. One cast, here.
	return createRenderer() as ParadocRenderer<RendererLayer, Output>
}

/**
 * Builds the `RendererLayer` a renderer receives for one layer.
 *
 * Text and binary layers carry their payload: an inline layer's text, or the
 * bytes a resolver reads for a file layer. A React layer carries none. Its path
 * is a pointer to a composition module, which the renderer binds; core neither
 * reads nor executes it, so no resolver is needed and none is asked for.
 *
 * @param site - Where the resolver was meant to come from, so a missing one
 * names the right remedy. An artifact instance passes `artifact`; the free
 * primitives above pass `layers`.
 *
 * @throws {InlineReactLayerError} when a React MIME type is declared inline.
 * @throws {UnboundResolverError} when a file layer has no resolver to read it.
 */
export async function buildRendererLayer(
	layerKey: string,
	layerSpec: Layer,
	bindings: Record<string, string> | undefined,
	resolver: Resolver | undefined,
	site: ResolverBindingSite,
): Promise<RendererLayer> {
	if (isReactLayerMimeType(layerSpec.mimeType)) {
		if (layerSpec.kind !== 'file') throw new InlineReactLayerError(layerKey)
		return {
			type: 'react',
			mimeType: layerSpec.mimeType,
			key: layerKey,
			path: layerSpec.path,
			...(bindings && { bindings }),
		}
	}

	let content: string | Uint8Array
	if (layerSpec.kind === 'inline') {
		content = layerSpec.text
	} else if (layerSpec.kind === 'file') {
		if (!resolver) {
			throw new UnboundResolverError(layerKey, layerSpec.path, site)
		}
		const bytes = await resolver.read(layerSpec.path)
		content =
			layerSpec.mimeType.startsWith('text/') || layerSpec.mimeType === 'application/json'
				? new TextDecoder().decode(bytes)
				: bytes
	} else {
		throw new Error('Unknown layer spec kind')
	}

	return {
		type: 'text',
		content,
		mimeType: layerSpec.mimeType,
		key: layerKey,
		...(layerSpec.kind === 'file' && { path: layerSpec.path }),
		...(bindings && { bindings }),
	}
}
