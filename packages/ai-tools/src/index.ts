import {
	ArtifactSourceSchema,
	FillInputSchema,
	FillStateInputSchema,
	GetArtifactInputSchema,
	GetRegistryInputSchema,
	InspectArtifactInputSchema,
	RenderInputSchema,
	SourceOperationSchema,
	SourceSchema,
	UpdateFillInputSchema,
	ValidateArtifactInputSchema,
	ValidateInputValueSchema,
	ValidateArtifactOutputSchema,
	ValidateInputOutputSchema,
	FillOutputSchema,
	UpdateFillOutputSchema,
	FillStateOutputSchema,
	RenderOutputSchema,
	GetRegistryOutputSchema,
	GetArtifactOutputSchema,
	InspectArtifactOutputSchema,
	operationNames,
	type FillInput,
	type FillStateInput,
	type GetArtifactInput,
	type GetRegistryInput,
	type InspectArtifactInput,
	type RenderInput,
	type UpdateFillInput,
	type ValidateArtifactInput,
	type ValidateInputValue,
	type FillOutput,
	type UpdateFillOutput,
	type FillStateOutput,
	type GetArtifactOutput,
	type GetRegistryOutput,
	type InspectArtifactOutput,
	type RenderOutput,
	type ValidateArtifactOutput,
	type ValidateInputOutput,
} from './contracts'
import type { ParadocToolsConfig } from './config'

export * from './contracts'
export * from './schemas'
export { createToolExecutionContext } from './context'
export type { ToolExecutionContext, RequestCache } from './context'
export type { ParadocToolsConfig } from './config'
export { resolveSource } from './resolve-source'
export type { ResolvedSource } from './resolve-source'
export {
	safeFetch,
	validateFetchUrl,
	fetchRegistryIndex,
	fetchRegistryIndexResponse,
	fetchRegistryItem,
	fetchRegistryItemResponse,
	buildArtifactItemUrl,
	resolveRelativeUrl,
	bytesToBase64,
	bytesToText,
} from './registry-client'

// These wrappers keep the package root free of document-core and renderer
// imports. The implementation module is loaded only when an operation runs.
export async function executeGetRegistry(input: GetRegistryInput | Record<string, unknown> = {}, config?: ParadocToolsConfig): Promise<GetRegistryOutput> {
	return (await import('./tools/get-registry')).executeGetRegistry(input, config)
}

export async function executeGetArtifact(input: GetArtifactInput | Record<string, unknown>, config?: ParadocToolsConfig): Promise<GetArtifactOutput> {
	return (await import('./tools/get-artifact')).executeGetArtifact(input, config)
}

export async function executeInspectArtifact(input: InspectArtifactInput | Record<string, unknown>, config?: ParadocToolsConfig): Promise<InspectArtifactOutput> {
	return (await import('./tools/inspect-artifact')).executeInspectArtifact(input, config)
}

export async function executeValidateArtifact(input: ValidateArtifactInput | Record<string, unknown>, config?: ParadocToolsConfig): Promise<ValidateArtifactOutput> {
	return (await import('./tools/validate')).executeValidateArtifact(input, config)
}

export async function executeValidateInput(input: ValidateInputValue | Record<string, unknown>, config?: ParadocToolsConfig): Promise<ValidateInputOutput> {
	return (await import('./tools/validate-input')).executeValidateInput(input, config)
}

export async function executeFill(input: FillInput | Record<string, unknown>, config?: ParadocToolsConfig): Promise<FillOutput> {
	return (await import('./tools/fill')).executeFill(input, config)
}

export async function executeGetFillState(input: FillStateInput | Record<string, unknown>, config?: ParadocToolsConfig): Promise<FillStateOutput> {
	return (await import('./tools/get-fill-state')).executeGetFillState(input, config)
}

export async function executeUpdateFill(input: UpdateFillInput | Record<string, unknown>, config?: ParadocToolsConfig): Promise<UpdateFillOutput> {
	return (await import('./tools/update-fill')).executeUpdateFill(input, config)
}

export async function executeRender(input: RenderInput | Record<string, unknown>, config?: ParadocToolsConfig): Promise<RenderOutput> {
	return (await import('./tools/render')).executeRender(input, config)
}

export const toolDefinitions = {
	get_registry: {
		name: 'get_registry',
		description: 'Discover the artifacts available in a Paradoc registry.',
		input_schema: GetRegistryInputSchema,
		output_schema: GetRegistryOutputSchema,
		execute: executeGetRegistry,
	},
	get_artifact: {
		name: 'get_artifact',
		description: 'Retrieve one artifact and optionally its instructions from a Paradoc registry.',
		input_schema: GetArtifactInputSchema,
		output_schema: GetArtifactOutputSchema,
		execute: executeGetArtifact,
	},
	inspect_artifact: {
		name: 'inspect_artifact',
		description: 'Return a bounded, selectable description of an artifact schema, targets, and layers.',
		input_schema: InspectArtifactInputSchema,
		output_schema: InspectArtifactOutputSchema,
		execute: executeInspectArtifact,
	},
	validate_artifact: {
		name: 'validate_artifact',
		description: 'Validate an artifact definition against the Paradoc schema and logic rules.',
		input_schema: ValidateArtifactInputSchema,
		output_schema: ValidateArtifactOutputSchema,
		execute: executeValidateArtifact,
	},
	validate_input: {
		name: 'validate_input',
		description: 'Validate and normalize one field, party, annex, or checklist item value using the owning artifact API.',
		input_schema: ValidateInputValueSchema,
		output_schema: ValidateInputOutputSchema,
		execute: executeValidateInput,
	},
	fill: {
		name: 'fill',
		description: 'Apply a seed payload to a form or checklist, reporting supplied-value acceptance separately from completeness.',
		input_schema: FillInputSchema,
		output_schema: UpdateFillOutputSchema,
		execute: executeFill,
	},
	get_fill_state: {
		name: 'get_fill_state',
		description: 'Inspect truthful draft progress, missing targets, rules, blocking, and the recommended next target.',
		input_schema: FillStateInputSchema,
		output_schema: FillStateOutputSchema,
		execute: executeGetFillState,
	},
	update_fill: {
		name: 'update_fill',
		description: 'Merge, clear, or reset an existing form or checklist draft while preserving untouched data and evaluation context.',
		input_schema: UpdateFillInputSchema,
		output_schema: FillOutputSchema,
		execute: executeUpdateFill,
	},
	render: {
		name: 'render',
		description: 'Render a form, document, or checklist using its selected layer and configured renderer.',
		input_schema: RenderInputSchema,
		output_schema: RenderOutputSchema,
		execute: executeRender,
	},
} as const

export type ToolDefinitions = typeof toolDefinitions
export { operationNames }
export { SourceSchema, SourceOperationSchema, ArtifactSourceSchema }
