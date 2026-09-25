import { createTool } from '@mastra/core/tools'
import {
	configForExecution,
	createToolExecutionContext,
	DEFAULT_MODEL_OUTPUT_MAX_BYTES,
	operationNames,
	toModelOutput,
	toolDefinitions,
	type ParadocToolsConfig,
} from '@paradoc/ai-tools'
import type { ZodType } from 'zod'

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
	OperationName,
	ParadocToolsConfig,
	RenderInput,
	RenderOutput,
	ToolDefinitions,
	UpdateFillInput,
	UpdateFillOutput,
	ValidateArtifactInput,
	ValidateArtifactOutput,
	ValidateInputOutput,
	ValidateInputValue,
} from '@paradoc/ai-tools'
export { operationNames }
export { createToolExecutionContext }

/** Configuration for the Mastra adapter and the shared Paradoc operations. */
export type ParadocMastraConfig = ParadocToolsConfig
export { DEFAULT_MODEL_OUTPUT_MAX_BYTES }

type MastraExecutionContext = {
	abortSignal?: AbortSignal
}

type MastraToolDefinition<Input, Output> = {
	name: string
	description: string
	input_schema: ZodType<Input>
	output_schema: ZodType<Output>
	execute: (input: Input, config?: ParadocToolsConfig) => Promise<Output>
}

function sharedConfig(config: ParadocMastraConfig | undefined): ParadocToolsConfig | undefined {
	return config
}

function executionConfig(config: ParadocMastraConfig | undefined, context: MastraExecutionContext): ParadocToolsConfig | undefined {
	const shared = sharedConfig(config)
	return configForExecution(shared, context.abortSignal)
}

function createMastraTool<Input, Output>(
	definition: MastraToolDefinition<Input, Output>,
	config?: ParadocMastraConfig,
) {
	return createTool({
		id: definition.name,
		description: definition.description,
		inputSchema: definition.input_schema,
		outputSchema: definition.output_schema,
		execute: async (input, context) => definition.execute(input, executionConfig(config, context)),
		toModelOutput: (output) => toModelOutput(output, config?.maxOutputBytes),
	})
}

export function getRegistry(config?: ParadocMastraConfig) {
	return createMastraTool(toolDefinitions.get_registry, config)
}

export function getArtifact(config?: ParadocMastraConfig) {
	return createMastraTool(toolDefinitions.get_artifact, config)
}

export function inspectArtifact(config?: ParadocMastraConfig) {
	return createMastraTool(toolDefinitions.inspect_artifact, config)
}

export function validateArtifact(config?: ParadocMastraConfig) {
	return createMastraTool(toolDefinitions.validate_artifact, config)
}

export function validateInput(config?: ParadocMastraConfig) {
	return createMastraTool(toolDefinitions.validate_input, config)
}

export function fill(config?: ParadocMastraConfig) {
	return createMastraTool(toolDefinitions.fill, config)
}

export function getFillState(config?: ParadocMastraConfig) {
	return createMastraTool(toolDefinitions.get_fill_state, config)
}

export function updateFill(config?: ParadocMastraConfig) {
	return createMastraTool(toolDefinitions.update_fill, config)
}

export function render(config?: ParadocMastraConfig) {
	return createMastraTool(toolDefinitions.render, config)
}

export function extract(config?: ParadocMastraConfig) {
	return createMastraTool(toolDefinitions.extract, config)
}

/** Create all ten shared Paradoc operations with their canonical snake_case IDs. */
export function paradocTools(config?: ParadocMastraConfig) {
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
	} as const
}
