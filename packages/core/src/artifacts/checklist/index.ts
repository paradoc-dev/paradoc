/**
 * Checklist artifact - closure-based implementation
 */

export { checklist, runtimeChecklistFromJSON, ChecklistValidationError } from './checklist'
export type {
	ChecklistInstance,
	RuntimeChecklist,
	DraftChecklist,
	CompletedChecklist,
	ChecklistInput,
	RuntimeChecklistJSON,
	InferChecklistPayload,
	ProgressiveChecklistPayload,
	ChecklistPath,
	ChecklistValidationMode,
	ChecklistFillOptions,
	ChecklistPartialFillOptions,
	ChecklistUpdateOptions,
	ChecklistValidationResult,
	ChecklistFillTarget,
	ChecklistFillItemState,
	ChecklistFillState,
	ItemStatusToDataType,
	ItemsToDataType,
	ChecklistBuilderInterface,
} from './checklist'

// Re-export layer render options from shared
