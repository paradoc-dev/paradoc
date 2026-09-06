/**
 * The MIME-keyed renderer registry core dispatches through.
 *
 * Core renders the layer formats it ships with — text, PDF, DOCX — through
 * `@paradoc/render`. Everything else arrives as an injection: a caller hands
 * core a renderer keyed by the layer's MIME type and core selects it the way it
 * selects a built-in one. That keeps a format's engine out of core. A React
 * composition is the case this exists for: `@paradoc/react` depends on
 * `@paradoc/render`, so registering the React renderer inside render would be a
 * cycle, and core must not depend on React to dispatch to it.
 *
 * The registry lives here rather than beside bundle assembly because form
 * rendering, document rendering, checklist rendering and bundle assembly all
 * read it.
 *
 * What counts as a React layer is not restated here. `@paradoc/schemas` owns
 * that rule, because it is the rule validation enforces, and dispatch reads the
 * same definition so the two cannot drift.
 */

import { isReactLayerMimeType, REACT_LAYER_MIME_TYPES, REACT_LAYER_RULE } from '@paradoc/schemas'
import type { Artifact, Layer, ParadocRenderer, ReactLayerMimeType, RendererLayer } from '@paradoc/types'

export { isReactLayerMimeType, REACT_LAYER_MIME_TYPES, REACT_LAYER_RULE }

/**
 * Renderers keyed by layer MIME type.
 *
 * `reactLayerRenderers` in `@paradoc/react/pdf` builds the entries for a React
 * composition; anything implementing `ParadocRenderer` can be an entry.
 *
 * @example
 * ```typescript
 * const renderers: RendererRegistry = {
 *   'text/tsx': reactRenderer({ components: { 'purchase-order.tsx': PurchaseOrder } }),
 * }
 * await form.render({ layer: 'composition', renderers })
 * ```
 */
export type RendererRegistry = Record<string, ParadocRenderer<RendererLayer, unknown>>

/**
 * The renderer registered for a MIME type.
 *
 * Matched without regard to case, which is how MIME types compare and how the
 * validation rule reads them.
 */
export function findRegisteredRenderer(
	registry: RendererRegistry | undefined,
	mimeType: string | undefined,
): ParadocRenderer<RendererLayer, unknown> | undefined {
	if (!registry || mimeType === undefined) return undefined
	const direct = registry[mimeType]
	if (direct) return direct
	const wanted = mimeType.toLowerCase()
	for (const [key, renderer] of Object.entries(registry)) {
		if (key.toLowerCase() === wanted) return renderer
	}
	return undefined
}

/** One React layer an artifact declares. */
export interface ReactLayerEntry {
	/** Key the artifact declares the layer under. */
	key: string
	/** Path of the composition module, as the artifact declares it. */
	path: string
	/** The layer's MIME type, exactly as written. */
	mimeType: string
}

/**
 * The React layers an artifact declares, in declaration order.
 *
 * One place to ask an artifact which composition renders it. The registry
 * generator, the dev preview and the check command all need that answer, and
 * each deriving it from the layer map would restate the MIME rule.
 *
 * Only file layers are returned. An inline layer of a React MIME type does not
 * exist in a valid artifact, and one built past validation names no module, so
 * there is nothing to report.
 */
export function reactLayersOf(artifact: { layers?: Record<string, Layer> } | Artifact): ReactLayerEntry[] {
	const layers = (artifact as { layers?: Record<string, Layer> }).layers
	if (!layers) return []
	const found: ReactLayerEntry[] = []
	for (const [key, layer] of Object.entries(layers)) {
		if (!isReactLayerMimeType(layer.mimeType) || layer.kind !== 'file') continue
		found.push({ key, path: layer.path, mimeType: layer.mimeType })
	}
	return found
}

/**
 * Thrown when a layer names a format core cannot render on its own and no
 * renderer was registered for it.
 */
export class UnregisteredLayerRendererError extends Error {
	/** Key the artifact declares the layer under. */
	readonly layer: string
	/** MIME type nothing was registered for. */
	readonly mimeType: string

	constructor(layer: string, mimeType: string) {
		super(
			`Layer "${layer}" has MIME type ${mimeType} and no renderer is registered for it. ` +
				'Core renders text, PDF and DOCX layers itself; every other format arrives as an injection. ' +
				'Pass one in the `renderers` option, keyed by MIME type — for a React composition, ' +
				'`reactLayerRenderers()` from @paradoc/react/pdf builds the entries.',
		)
		this.name = 'UnregisteredLayerRendererError'
		this.layer = layer
		this.mimeType = mimeType
	}
}

/**
 * Thrown when a React layer is declared inline. Validation rejects this shape,
 * so it is reached only by an artifact assembled without it.
 */
export class InlineReactLayerError extends Error {
	/** Key the artifact declares the layer under. */
	readonly layer: string

	constructor(layer: string) {
		super(`Layer "${layer}" is inline with a React MIME type. ${REACT_LAYER_RULE}.`)
		this.name = 'InlineReactLayerError'
		this.layer = layer
	}
}

/** Re-exported so a caller can name the type a React layer's MIME type has. */
export type { ReactLayerMimeType }
