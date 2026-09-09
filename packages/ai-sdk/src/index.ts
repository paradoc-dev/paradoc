import { tool, type FlexibleSchema, type Tool, type ToolExecutionOptions, type ToolSet } from 'ai'
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
	type UpdateFillInput,
	type UpdateFillOutput,
	type ValidateArtifactInput,
	type ValidateArtifactOutput,
	type ValidateInputOutput,
	type ValidateInputValue,
	type ToolDefinitions,
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
	RenderInput,
	RenderOutput,
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

function configForExecution(config: ParadocToolsConfig | undefined, abortSignal: AbortSignal | undefined): ParadocToolsConfig {
	const signal = mergeAbortSignals(config?.signal, config?.context?.signal, abortSignal)
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

function createTool<Name extends OperationName>(name: Name, config?: ParadocToolsConfig): ParadocTool<Name> {
	const definition = toolDefinitions[name] as unknown as AdapterDefinition<Name>

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
	return createTool('get_registry', config)
}

/** Create the registry artifact retrieval tool. */
export function getArtifact(config?: ParadocToolsConfig): ParadocTool<'get_artifact'> {
	return createTool('get_artifact', config)
}

/** Create the bounded artifact inspection tool. */
export function inspectArtifact(config?: ParadocToolsConfig): ParadocTool<'inspect_artifact'> {
	return createTool('inspect_artifact', config)
}

/** Create the artifact validation tool. */
export function validateArtifact(config?: ParadocToolsConfig): ParadocTool<'validate_artifact'> {
	return createTool('validate_artifact', config)
}

/** Create the progressive input validation tool. */
export function validateInput(config?: ParadocToolsConfig): ParadocTool<'validate_input'> {
	return createTool('validate_input', config)
}

/** Create the initial draft fill tool. */
export function fill(config?: ParadocToolsConfig): ParadocTool<'fill'> {
	return createTool('fill', config)
}

/** Create the draft progress inspection tool. */
export function getFillState(config?: ParadocToolsConfig): ParadocTool<'get_fill_state'> {
	return createTool('get_fill_state', config)
}

/** Create the draft update tool. */
export function updateFill(config?: ParadocToolsConfig): ParadocTool<'update_fill'> {
	return createTool('update_fill', config)
}

/** Create the artifact rendering tool. */
export function render(config?: ParadocToolsConfig): ParadocTool<'render'> {
	return createTool('render', config)
}

/**
 * Return all nine native AI SDK tools, keyed by their canonical model-facing
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
	}
}

export { operationNames }
