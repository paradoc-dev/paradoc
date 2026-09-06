/**
 * Document artifact - closure-based implementation
 */

export { document, runtimeDocumentFromJSON } from './document'
export type {
	DocumentInstance,
	RuntimeDocument,
	DraftDocument,
	FinalDocument,
	DocumentInput,
	RuntimeDocumentJSON,
	DocumentBuilderInterface,
} from './document'

// Re-export layer render options from shared
export type { ArtifactLayerRenderOptions } from '../shared/render-layer'
