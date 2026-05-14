/**
 * Layer Rendering - Shared layer resolution and rendering logic
 *
 * This extracts the common render logic that was duplicated across
 * DocumentInstance, DraftDocument, and FinalDocument.
 */

import type { Layer, Resolver } from '@paradoc/types'

/**
 * Options for resolving/rendering layer content
 */
export interface LayerRenderOptions {
	/** Resolver for file-backed layers. Required if the target layer is file-backed. */
	resolver?: Resolver
	/** Override the target layer for this render call. */
	layer?: string
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
 * Renders layer content from a layers record.
 *
 * Handles both inline (embedded text) and file-backed layers.
 * For file-backed layers, requires a resolver to read the file content.
 * Automatically decodes text-based mime types to strings.
 *
 * @param layers - The layers record from the artifact
 * @param layerKey - The key of the layer to render
 * @param options - Render options including optional resolver
 * @returns Promise resolving to layer content (string for text, Uint8Array for binary)
 * @throws Error if layer not found or resolver required but not provided
 */
export async function renderLayer(
	layers: Record<string, Layer> | undefined,
	layerKey: string,
	options?: LayerRenderOptions,
): Promise<string | Uint8Array> {
	if (!layers) {
		throw new Error('No layers defined')
	}

	const layerSpec = layers[layerKey]
	if (!layerSpec) {
		throw new Error(`Layer "${layerKey}" not found. Available layers: ${Object.keys(layers).join(', ')}`)
	}

	// Handle inline layers - return embedded text directly
	if (layerSpec.kind === 'inline') {
		return layerSpec.text
	}

	// Handle file-backed layers - requires resolver
	if (layerSpec.kind === 'file') {
		if (!options?.resolver) {
			throw new Error(
				`Layer "${layerKey}" is file-backed but no resolver was provided. ` +
					'Pass a resolver in the options object to load file layers.',
			)
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
): Promise<string | Uint8Array> {
	const key = resolveLayerKey(layers, targetLayer, defaultLayer, options)
	return renderLayer(layers, key, options)
}
