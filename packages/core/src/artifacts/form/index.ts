/**
 * Form Artifact - Closure-based implementation
 * Barrel export
 */

export { form, runtimeFormFromJSON, FormValidationError, FormRuleViolationError } from './form'
export { SealConfigError, buildSlotPlan, compileLegacySignatureSlots } from './seal-slots'
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
} from './form'
