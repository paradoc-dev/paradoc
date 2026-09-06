/**
 * Shared utilities for artifacts
 */

export { withArtifactMethods } from './artifact-methods'
export type { ArtifactMethods } from './artifact-methods'

export { renderLayer, resolveLayerKey, resolveAndRenderLayer, UnboundResolverError } from './render-layer'
export type {
	ArtifactInstanceOptions,
	ArtifactLayerRenderOptions,
	LayerRenderOptions,
	ResolverBindingSite,
} from './render-layer'

export { resolveBuildable } from './buildable'
export type { Buildable, BuildableRecord, BuildableArray } from './buildable'
