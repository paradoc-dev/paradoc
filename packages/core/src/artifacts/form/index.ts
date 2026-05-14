/**
 * Form Artifact - Closure-based implementation
 * Barrel export
 */

export { form, runtimeFormFromJSON, FormValidationError, FormRuleViolationError } from './form'
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
	FormBuilderInterface,
	FillValidationOptions,
	SafeFillResult,
	SafePartialFillResult,
	FormValidationResult,
} from './form'
export type { LayerRenderOptions } from '../shared/render-layer'
