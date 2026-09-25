/**
 * Form Artifact - Closure-based implementation
 * Barrel export
 */

export { form, runtimeFormFromJSON, FormValidationError, FormRuleViolationError } from './form'
export { SealConfigError, buildSlotPlan } from './seal-slots'
export { INITIALS_RULE, SIGNATURE_RULE } from './seal-renderer'
export type { SlotPlan } from './seal-slots'
export type { PlacementProvenance, SealPreparation } from './seal-slots'
export type {
	FormInstance,
	RuntimeForm,
	DraftForm,
	SignableForm,
	ExecutedForm,
	FormInput,
	RuntimeFormJSON,
	InferFormPayload,
	ProgressiveFormPayload,
	FormPath,
	ExtractFields,
	FieldKeys,
	PartyRoleKeys,
	CaptureOptions,
	SealOptions,
	FormBuilderInterface,
	SafeFillResult,
	FormValidationResult,
	ExtractOptions,
	FormExtraction,
} from './form'
