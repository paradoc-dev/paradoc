import {
	toolDefinition,
	type ServerTool,
	type ToolDefinition,
	type ToolExecuteFunction,
	type ToolExecutionContext,
} from '@tanstack/ai'
import {
	attachModelOutputSerialization,
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
	OperationName,
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

type OperationExecutor<Name extends OperationName> = (
	input: OperationInput<Name>,
	config?: ParadocToolsConfig,
) => Promise<OperationOutput<Name>>

export type ParadocToolDefinition<Name extends OperationName = OperationName> = ToolDefinition<
	ToolDefinitions[Name]['input_schema'],
	ToolDefinitions[Name]['output_schema'],
	Name
>

export type ParadocServerTool<Name extends OperationName = OperationName> = ServerTool<
	ToolDefinitions[Name]['input_schema'],
	ToolDefinitions[Name]['output_schema'],
	Name
>

export type ParadocToolDefinitions = readonly [
	ParadocToolDefinition<'get_registry'>,
	ParadocToolDefinition<'get_artifact'>,
	ParadocToolDefinition<'inspect_artifact'>,
	ParadocToolDefinition<'validate_artifact'>,
	ParadocToolDefinition<'validate_input'>,
	ParadocToolDefinition<'fill'>,
	ParadocToolDefinition<'get_fill_state'>,
	ParadocToolDefinition<'update_fill'>,
	ParadocToolDefinition<'render'>,
	ParadocToolDefinition<'extract'>,
]

export type ParadocToolSet = readonly [
	ParadocServerTool<'get_registry'>,
	ParadocServerTool<'get_artifact'>,
	ParadocServerTool<'inspect_artifact'>,
	ParadocServerTool<'validate_artifact'>,
	ParadocServerTool<'validate_input'>,
	ParadocServerTool<'fill'>,
	ParadocServerTool<'get_fill_state'>,
	ParadocServerTool<'update_fill'>,
	ParadocServerTool<'render'>,
	ParadocServerTool<'extract'>,
]

function definitionFor<Name extends OperationName>(name: Name): ParadocToolDefinition<Name> {
	const definition = toolDefinitions[name]
	return toolDefinition({
		name,
		description: definition.description,
		inputSchema: definition.input_schema,
		outputSchema: definition.output_schema,
	}) as ParadocToolDefinition<Name>
}

const definitions = {
	get_registry: definitionFor('get_registry'),
	get_artifact: definitionFor('get_artifact'),
	inspect_artifact: definitionFor('inspect_artifact'),
	validate_artifact: definitionFor('validate_artifact'),
	validate_input: definitionFor('validate_input'),
	fill: definitionFor('fill'),
	get_fill_state: definitionFor('get_fill_state'),
	update_fill: definitionFor('update_fill'),
	render: definitionFor('render'),
	extract: definitionFor('extract'),
} satisfies { [Name in OperationName]: ParadocToolDefinition<Name> }

function createTool<Name extends OperationName>(name: Name, config?: ParadocToolsConfig): ParadocServerTool<Name> {
	const operation = toolDefinitions[name].execute as unknown as OperationExecutor<Name>
	const execute = (async (input: OperationInput<Name>, context?: ToolExecutionContext) =>
		operation(input, configForExecution(config, context?.abortSignal))) as ToolExecuteFunction<
		ToolDefinitions[Name]['input_schema'],
		ToolDefinitions[Name]['output_schema']
	>
	const shared = toolDefinitions[name]
	// TanStack serializes the validated output directly for the next model turn.
	// A schema transform preserves the full value while supplying its bounded JSON form.
	const definition = toolDefinition({
		name,
		description: shared.description,
		inputSchema: shared.input_schema,
		outputSchema: shared.output_schema.transform((output) => attachModelOutputSerialization(output, config?.maxOutputBytes)),
	})

	return definition.server(execute as never) as unknown as ParadocServerTool<Name>
}

/** Return the definition-only tools for client registration or a shared chat declaration. */
export function paradocToolDefinitions(): ParadocToolDefinitions {
	return [
		definitions.get_registry,
		definitions.get_artifact,
		definitions.inspect_artifact,
		definitions.validate_artifact,
		definitions.validate_input,
		definitions.fill,
		definitions.get_fill_state,
		definitions.update_fill,
		definitions.render,
		definitions.extract,
	]
}

/** Create the registry discovery tool. */
export function getRegistry(config?: ParadocToolsConfig): ParadocServerTool<'get_registry'> {
	return createTool('get_registry', config)
}

/** Return the registry discovery definition without server execution context. */
export function getRegistryDefinition(): ParadocToolDefinition<'get_registry'> {
	return definitions.get_registry
}

/** Create the registry artifact retrieval tool. */
export function getArtifact(config?: ParadocToolsConfig): ParadocServerTool<'get_artifact'> {
	return createTool('get_artifact', config)
}

/** Return the registry artifact retrieval definition without server execution context. */
export function getArtifactDefinition(): ParadocToolDefinition<'get_artifact'> {
	return definitions.get_artifact
}

/** Create the bounded artifact inspection tool. */
export function inspectArtifact(config?: ParadocToolsConfig): ParadocServerTool<'inspect_artifact'> {
	return createTool('inspect_artifact', config)
}

/** Return the bounded artifact inspection definition without server execution context. */
export function inspectArtifactDefinition(): ParadocToolDefinition<'inspect_artifact'> {
	return definitions.inspect_artifact
}

/** Create the artifact validation tool. */
export function validateArtifact(config?: ParadocToolsConfig): ParadocServerTool<'validate_artifact'> {
	return createTool('validate_artifact', config)
}

/** Return the artifact validation definition without server execution context. */
export function validateArtifactDefinition(): ParadocToolDefinition<'validate_artifact'> {
	return definitions.validate_artifact
}

/** Create the progressive input validation tool. */
export function validateInput(config?: ParadocToolsConfig): ParadocServerTool<'validate_input'> {
	return createTool('validate_input', config)
}

/** Return the progressive input validation definition without server execution context. */
export function validateInputDefinition(): ParadocToolDefinition<'validate_input'> {
	return definitions.validate_input
}

/** Create the initial draft fill tool. */
export function fill(config?: ParadocToolsConfig): ParadocServerTool<'fill'> {
	return createTool('fill', config)
}

/** Return the initial draft fill definition without server execution context. */
export function fillDefinition(): ParadocToolDefinition<'fill'> {
	return definitions.fill
}

/** Create the draft progress inspection tool. */
export function getFillState(config?: ParadocToolsConfig): ParadocServerTool<'get_fill_state'> {
	return createTool('get_fill_state', config)
}

/** Return the draft progress inspection definition without server execution context. */
export function getFillStateDefinition(): ParadocToolDefinition<'get_fill_state'> {
	return definitions.get_fill_state
}

/** Create the draft update tool. */
export function updateFill(config?: ParadocToolsConfig): ParadocServerTool<'update_fill'> {
	return createTool('update_fill', config)
}

/** Return the draft update definition without server execution context. */
export function updateFillDefinition(): ParadocToolDefinition<'update_fill'> {
	return definitions.update_fill
}

/** Create the artifact rendering tool. */
export function render(config?: ParadocToolsConfig): ParadocServerTool<'render'> {
	return createTool('render', config)
}

/** Return the artifact rendering definition without server execution context. */
export function renderDefinition(): ParadocToolDefinition<'render'> {
	return definitions.render
}

/** Create the filled-PDF extraction tool. */
export function extract(config?: ParadocToolsConfig): ParadocServerTool<'extract'> {
	return createTool('extract', config)
}

/** Return the filled-PDF extraction definition without server execution context. */
export function extractDefinition(): ParadocToolDefinition<'extract'> {
	return definitions.extract
}

/** Create all ten native TanStack AI server tools for `chat({ tools })`. */
export function paradocTools(config?: ParadocToolsConfig): ParadocToolSet {
	return [
		getRegistry(config),
		getArtifact(config),
		inspectArtifact(config),
		validateArtifact(config),
		validateInput(config),
		fill(config),
		getFillState(config),
		updateFill(config),
		render(config),
		extract(config),
	]
}

export { operationNames }
