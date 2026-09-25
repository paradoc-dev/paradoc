import { tool, type FlexibleSchema, type Tool, type ToolExecutionOptions, type ToolSet } from 'ai'
import {
	configForExecution,
	operationNames,
	toolDefinitions,
	type OperationName,
	type OperationInput,
	type OperationOutput,
	type ParadocToolsConfig,
	type ToolDefinitions,
} from '@paradoc/ai-tools'

export type { ParadocToolsConfig }
export type {
	ExtractInput,
	ExtractOutput,
	FillInput,
	FillOutput,
	FillStateInput,
	FillStateOutput,
	GetArtifactInput,
	GetArtifactOutput,
	GetRegistryInput,
	GetRegistryOutput,
	InspectArtifactInput,
	InspectArtifactOutput,
	RenderInput,
	RenderOutput,
	UpdateFillInput,
	UpdateFillOutput,
	ValidateArtifactInput,
	ValidateArtifactOutput,
	ValidateInputOutput,
	ValidateInputValue,
} from '@paradoc/ai-tools'

type AdapterDefinition<Name extends OperationName> = {
	name: Name
	description: string
	input_schema: ToolDefinitions[Name]['input_schema']
	output_schema: ToolDefinitions[Name]['output_schema']
	execute: (input: OperationInput<Name>, config?: ParadocToolsConfig) => Promise<OperationOutput<Name>>
}

/** A typed, executable AI SDK tool for one canonical Paradoc operation. */
export type ParadocTool<Name extends OperationName> = Tool<OperationInput<Name>, OperationOutput<Name>> & ToolSet[string] & {
	execute: (input: OperationInput<Name>, options: ToolExecutionOptions<Record<string, unknown>>) => Promise<OperationOutput<Name>>
}

/** The native AI SDK tool map returned by {@link paradocTools}. */
export type ParadocToolSet = {
	[Name in OperationName]: ParadocTool<Name>
}

function createTool<Name extends OperationName>(definition: AdapterDefinition<Name>, config?: ParadocToolsConfig): ParadocTool<Name> {
	const nativeTool = tool<unknown, unknown, Record<string, unknown>>({
		description: definition.description,
		inputSchema: definition.input_schema as unknown as FlexibleSchema<unknown>,
		outputSchema: definition.output_schema as unknown as FlexibleSchema<unknown>,
		execute: async (input: unknown, options: ToolExecutionOptions<Record<string, unknown>>) =>
			definition.execute(input as OperationInput<Name>, configForExecution(config, options.abortSignal)),
	})

	return nativeTool as unknown as ParadocTool<Name>
}

/** Create the registry discovery tool. */
export function getRegistry(config?: ParadocToolsConfig): ParadocTool<'get_registry'> {
	return createTool(toolDefinitions.get_registry, config)
}

/** Create the registry artifact retrieval tool. */
export function getArtifact(config?: ParadocToolsConfig): ParadocTool<'get_artifact'> {
	return createTool(toolDefinitions.get_artifact, config)
}

/** Create the bounded artifact inspection tool. */
export function inspectArtifact(config?: ParadocToolsConfig): ParadocTool<'inspect_artifact'> {
	return createTool(toolDefinitions.inspect_artifact, config)
}

/** Create the artifact validation tool. */
export function validateArtifact(config?: ParadocToolsConfig): ParadocTool<'validate_artifact'> {
	return createTool(toolDefinitions.validate_artifact, config)
}

/** Create the progressive input validation tool. */
export function validateInput(config?: ParadocToolsConfig): ParadocTool<'validate_input'> {
	return createTool(toolDefinitions.validate_input, config)
}

/** Create the initial draft fill tool. */
export function fill(config?: ParadocToolsConfig): ParadocTool<'fill'> {
	return createTool(toolDefinitions.fill, config)
}

/** Create the draft progress inspection tool. */
export function getFillState(config?: ParadocToolsConfig): ParadocTool<'get_fill_state'> {
	return createTool(toolDefinitions.get_fill_state, config)
}

/** Create the draft update tool. */
export function updateFill(config?: ParadocToolsConfig): ParadocTool<'update_fill'> {
	return createTool(toolDefinitions.update_fill, config)
}

/** Create the artifact rendering tool. */
export function render(config?: ParadocToolsConfig): ParadocTool<'render'> {
	return createTool(toolDefinitions.render, config)
}

/** Create the filled-PDF extraction tool. */
export function extract(config?: ParadocToolsConfig): ParadocTool<'extract'> {
	return createTool(toolDefinitions.extract, config)
}

/**
 * Return all ten native AI SDK tools, keyed by their canonical model-facing
 * snake_case names.
 */
export function paradocTools(config?: ParadocToolsConfig): ParadocToolSet {
	return {
		get_registry: getRegistry(config),
		get_artifact: getArtifact(config),
		inspect_artifact: inspectArtifact(config),
		validate_artifact: validateArtifact(config),
		validate_input: validateInput(config),
		fill: fill(config),
		get_fill_state: getFillState(config),
		update_fill: updateFill(config),
		render: render(config),
		extract: extract(config),
	}
}

export { operationNames }
