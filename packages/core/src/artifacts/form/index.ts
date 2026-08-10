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
	ExtractFields,
	FieldKeys,
	PartyRoleKeys,
	CaptureOptions,
	SealOptions,
	FormBuilderInterface,
	FillValidationOptions,
	SafeFillResult,
	SafePartialFillResult,
	FormValidationResult,
} from './form'
export type { LayerRenderOptions } from '../shared/render-layer'
