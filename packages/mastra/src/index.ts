import { createTool } from '@mastra/core/tools'
import {
	operationNames,
	toolDefinitions,
	type ParadocToolsConfig,
} from '@paradoc/ai-tools'
import type { ZodType } from 'zod'

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

/** Configuration for the Mastra adapter and the shared Paradoc operations. */
export interface ParadocMastraConfig extends ParadocToolsConfig {
	/** Maximum UTF-8 or decoded binary bytes exposed to the model by `toModelOutput`. */
	modelOutputMaxBytes?: number
}

export const DEFAULT_MODEL_OUTPUT_MAX_BYTES = 16_384

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

type ContentResult = {
	content: string
	encoding?: 'utf-8' | 'base64'
	byte_length?: number
	truncated?: boolean
	[key: string]: unknown
}

function isContentResult(value: unknown): value is ContentResult {
	return typeof value === 'object' && value !== null && !Array.isArray(value) && typeof (value as { content?: unknown }).content === 'string'
}

function modelBudget(value: number | undefined): number {
	if (value === undefined || !Number.isFinite(value)) return DEFAULT_MODEL_OUTPUT_MAX_BYTES
	return Math.max(1, Math.floor(value))
}

function boundedModelOutput<Output>(output: Output, requestedMaxBytes: number | undefined): Output {
	if (!isContentResult(output)) return output

	const maxBytes = modelBudget(requestedMaxBytes)
	const encoding = output.encoding ?? 'utf-8'
	if (encoding === 'base64') {
		const maxChars = Math.floor(maxBytes / 3) * 4
		if (output.content.length <= maxChars) return output
		return { ...output, content: output.content.slice(0, maxChars), truncated: true } as Output
	}

	const bytes = new TextEncoder().encode(output.content)
	if (bytes.byteLength <= maxBytes) return output
	return {
		...output,
		content: new TextDecoder().decode(bytes.slice(0, maxBytes)),
		truncated: true,
	} as Output
}

function sharedConfig(config: ParadocMastraConfig | undefined): ParadocToolsConfig | undefined {
	if (!config) return undefined
	const shared = { ...config }
	delete shared.modelOutputMaxBytes
	return shared
}

function executionConfig(config: ParadocMastraConfig | undefined, context: MastraExecutionContext): ParadocToolsConfig | undefined {
	const shared = sharedConfig(config)
	if (!context.abortSignal) return shared
	return { ...shared, signal: context.abortSignal }
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
		toModelOutput: (output) => boundedModelOutput(output, config?.modelOutputMaxBytes),
	})
}

export function createGetRegistryTool(config?: ParadocMastraConfig) {
	return createMastraTool(toolDefinitions.get_registry, config)
}

export function createGetArtifactTool(config?: ParadocMastraConfig) {
	return createMastraTool(toolDefinitions.get_artifact, config)
}

export function createInspectArtifactTool(config?: ParadocMastraConfig) {
	return createMastraTool(toolDefinitions.inspect_artifact, config)
}

export function createValidateArtifactTool(config?: ParadocMastraConfig) {
	return createMastraTool(toolDefinitions.validate_artifact, config)
}

export function createValidateInputTool(config?: ParadocMastraConfig) {
	return createMastraTool(toolDefinitions.validate_input, config)
}

export function createFillTool(config?: ParadocMastraConfig) {
	return createMastraTool(toolDefinitions.fill, config)
}

export function createGetFillStateTool(config?: ParadocMastraConfig) {
	return createMastraTool(toolDefinitions.get_fill_state, config)
}

export function createUpdateFillTool(config?: ParadocMastraConfig) {
	return createMastraTool(toolDefinitions.update_fill, config)
}

export function createRenderTool(config?: ParadocMastraConfig) {
	return createMastraTool(toolDefinitions.render, config)
}

/** Create all nine shared Paradoc operations with their canonical snake_case IDs. */
export function paradocTools(config?: ParadocMastraConfig) {
	return {
		get_registry: createGetRegistryTool(config),
		get_artifact: createGetArtifactTool(config),
		inspect_artifact: createInspectArtifactTool(config),
		validate_artifact: createValidateArtifactTool(config),
		validate_input: createValidateInputTool(config),
		fill: createFillTool(config),
		get_fill_state: createGetFillStateTool(config),
		update_fill: createUpdateFillTool(config),
		render: createRenderTool(config),
	} as const
}

export const createParadocTools = paradocTools
export const createMastraTools = paradocTools
