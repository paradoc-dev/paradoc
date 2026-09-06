/**
 * Rendering module - the renderer registry and bundle assembly utilities
 */

export { assembleBundle } from './bundle-assembler'
export type {
  ResolvedArtifact,
  ArtifactResolver,
  AssemblyContentEntry,
  BundleAssemblyOptions,
  AssembledBundleOutput,
  AssembledBundle,
} from './bundle-assembler'
export {
  InlineReactLayerError,
  isReactLayerMimeType,
  reactLayersOf,
  REACT_LAYER_MIME_TYPES,
  REACT_LAYER_RULE,
  UnregisteredLayerRendererError,
} from './renderer-registry'
export type { ReactLayerEntry, RendererRegistry } from './renderer-registry'
