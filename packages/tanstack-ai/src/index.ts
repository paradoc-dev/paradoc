import {
	toolDefinition,
	type ServerTool,
	type ToolDefinition,
	type ToolExecuteFunction,
	type ToolExecutionContext,
} from '@tanstack/ai'
import {
	createToolExecutionContext,
	operationNames,
	toolDefinitions,
	type FillInput,
	type FillOutput,
	type FillStateInput,
	type FillStateOutput,
	type GetArtifactInput,
	type GetArtifactOutput,
	type GetRegistryInput,
	type GetRegistryOutput,
	type InspectArtifactInput,
	type InspectArtifactOutput,
	type OperationName,
	type ParadocToolsConfig,
	type RenderInput,
	type RenderOutput,
	type ToolDefinitions,
	type UpdateFillInput,
	type UpdateFillOutput,
	type ValidateArtifactInput,
	type ValidateArtifactOutput,
	type ValidateInputOutput,
	type ValidateInputValue,
} from '@paradoc/ai-tools'

export type { ParadocToolsConfig }
export type {
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

type OperationInputs = {
	get_registry: GetRegistryInput
	get_artifact: GetArtifactInput
	inspect_artifact: InspectArtifactInput
	validate_artifact: ValidateArtifactInput
	validate_input: ValidateInputValue
	fill: FillInput
	get_fill_state: FillStateInput
	update_fill: UpdateFillInput
	render: RenderInput
}

type OperationOutputs = {
	get_registry: GetRegistryOutput
	get_artifact: GetArtifactOutput
	inspect_artifact: InspectArtifactOutput
	validate_artifact: ValidateArtifactOutput
	validate_input: ValidateInputOutput
	fill: FillOutput
	get_fill_state: FillStateOutput
	update_fill: UpdateFillOutput
	render: RenderOutput
}

type OperationInput<Name extends OperationName> = OperationInputs[Name]
type OperationOutput<Name extends OperationName> = OperationOutputs[Name]
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
]

function mergeAbortSignals(...signals: Array<AbortSignal | undefined>): AbortSignal | undefined {
	const present = signals.filter((signal): signal is AbortSignal => signal !== undefined)
	if (present.length === 0) return undefined
	if (present.length === 1) return present[0]
	if (typeof AbortSignal.any === 'function') return AbortSignal.any(present)

	const controller = new AbortController()
	const abort = (signal: AbortSignal) => controller.abort(signal.reason)
	for (const signal of present) {
		if (signal.aborted) {
			abort(signal)
			break
		}
		signal.addEventListener('abort', () => abort(signal), { once: true })
	}
	return controller.signal
}

function configForExecution(
	config: ParadocToolsConfig | undefined,
	context: ToolExecutionContext | undefined,
): ParadocToolsConfig {
	const signal = mergeAbortSignals(config?.signal, config?.context?.signal, context?.abortSignal)
	const configuredContext = config?.context
		? signal && config.context.signal !== signal
			? { ...config.context, signal }
			: config.context
		: createToolExecutionContext(signal ? { signal } : {})

	return {
		...config,
		...(signal ? { signal } : {}),
		context: configuredContext,
	}
}

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
} satisfies { [Name in OperationName]: ParadocToolDefinition<Name> }

function createTool<Name extends OperationName>(name: Name, config?: ParadocToolsConfig): ParadocServerTool<Name> {
	const operation = toolDefinitions[name].execute as unknown as OperationExecutor<Name>
	const execute = (async (input: OperationInput<Name>, context?: ToolExecutionContext) =>
		operation(input, configForExecution(config, context))) as unknown as ToolExecuteFunction<
		ToolDefinitions[Name]['input_schema'],
		ToolDefinitions[Name]['output_schema']
	>
	const definition = definitions[name] as ParadocToolDefinition<Name>

	return definition.server(execute) as ParadocServerTool<Name>
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

/** Create all nine native TanStack AI server tools for `chat({ tools })`. */
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
	]
}

export { operationNames }
