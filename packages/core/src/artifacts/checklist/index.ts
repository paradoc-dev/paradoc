/**
 * Checklist artifact - closure-based implementation
 */

export { checklist, runtimeChecklistFromJSON } from './checklist'
export type {
	ChecklistInstance,
	RuntimeChecklist,
	DraftChecklist,
	CompletedChecklist,
	ChecklistInput,
	RuntimeChecklistJSON,
	InferChecklistPayload,
	ItemStatusToDataType,
	ItemsToDataType,
	ChecklistBuilderInterface,
} from './checklist'

// Re-export layer render options from shared
export type { LayerRenderOptions } from '../shared/render-layer'
