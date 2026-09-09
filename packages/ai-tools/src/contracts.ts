import { z } from 'zod'

/**
 * The neutral tool contract is deliberately expressed in the model-facing
 * wire format. Runtime code translates these snake_case fields at its
 * boundary and keeps its TypeScript identifiers idiomatic.
 */

const JsonObjectSchema = z.record(z.string(), z.unknown())

export const ArtifactSourceSchema = z.object({
	source: z.literal('artifact'),
	artifact: JsonObjectSchema.describe('Paradoc artifact JSON object'),
	base_url: z.string().url().optional().describe('Base URL for file-backed layers'),
})

export const UrlSourceSchema = z.object({
	source: z.literal('url'),
	url: z.string().url().describe('URL to a Paradoc artifact JSON file'),
})

export const RegistrySourceSchema = z.object({
	source: z.literal('registry'),
	registry_url: z.string().url().describe('Registry base URL'),
	artifact_name: z.string().min(1).describe('Artifact name within the registry'),
})

export const SourceSchema = z.discriminatedUnion('source', [
	ArtifactSourceSchema,
	UrlSourceSchema,
	RegistrySourceSchema,
])

export type ArtifactSourceInput = z.infer<typeof ArtifactSourceSchema>
export type UrlSourceInput = z.infer<typeof UrlSourceSchema>
export type RegistrySourceInput = z.infer<typeof RegistrySourceSchema>
export type SourceInput = z.infer<typeof SourceSchema>

const SourceShape = {
	artifact: JsonObjectSchema.optional().describe('Paradoc artifact JSON object'),
	base_url: z.string().url().optional().describe('Base URL for file-backed layers'),
	url: z.string().url().optional().describe('URL to a Paradoc artifact JSON file'),
	registry_url: z.string().url().optional().describe('Registry base URL'),
	artifact_name: z.string().min(1).optional().describe('Artifact name within the registry'),
}

/**
 * Provider schemas use one object so providers that cannot represent a
 * discriminated union can still expose the same canonical contract. The
 * execution boundary performs the source-specific validation once.
 */
export const SourceOperationSchema = z.object({
	source: z.enum(['artifact', 'url', 'registry']),
	...SourceShape,
})

function withSourceFields<T extends z.ZodRawShape>(shape: T) {
	return z.discriminatedUnion('source', [
		ArtifactSourceSchema.extend(shape),
		UrlSourceSchema.extend(shape),
		RegistrySourceSchema.extend(shape),
	])
}

export const GetRegistryInputSchema = z.object({
	registry_url: z.string().url().optional().describe('Registry base URL'),
})
export type GetRegistryInput = z.infer<typeof GetRegistryInputSchema>

export const GetArtifactInputSchema = z.object({
	registry_url: z.string().url().optional().describe('Registry base URL'),
	artifact_name: z.string().min(1).describe('Artifact name within the registry'),
	include_instructions: z.boolean().optional().default(true),
	include_agent_instructions: z.boolean().optional().default(true),
})
export type GetArtifactInput = z.infer<typeof GetArtifactInputSchema>

export const InspectArtifactInputSchema = withSourceFields({
	sections: z
		.array(z.enum(['metadata', 'fields', 'parties', 'annexes', 'items', 'layers']))
		.min(1)
		.optional()
		.describe('Sections to include; defaults to every available section'),
	max_items: z
		.number()
		.int()
		.positive()
		.max(500)
		.optional()
		.default(100)
		.describe('Maximum entries returned for each selected section'),
})
export type InspectArtifactInput = z.infer<typeof InspectArtifactInputSchema>

export const ValidateOptionsSchema = z
	.object({
		schema: z.boolean().optional().default(true),
		logic: z.boolean().optional().default(true),
	})
	.optional()

export const ValidateArtifactInputSchema = withSourceFields({
	options: ValidateOptionsSchema,
})
export type ValidateArtifactInput = z.infer<typeof ValidateArtifactInputSchema>

export const ValidateInputTargetSchema = z.enum(['field', 'party', 'annex', 'checklist_item'])

const ValidateInputSelectorsSchema = {
	target: ValidateInputTargetSchema.describe('Artifact target to validate'),
	field_path: z.string().optional().describe('Field path for target="field"'),
	role_id: z.string().optional().describe('Party role ID for target="party"'),
	index: z.number().int().nonnegative().optional().describe('Party index, default 0'),
	annex_id: z.string().optional().describe('Annex ID for target="annex"'),
	item_id: z.string().optional().describe('Checklist item ID for target="checklist_item"'),
	value: z.unknown().describe('Value supplied for the selected target'),
}

export const ValidateInputValueSchema = withSourceFields(ValidateInputSelectorsSchema)
export type ValidateInputValue = z.infer<typeof ValidateInputValueSchema>

export const FillDataSchema = JsonObjectSchema.describe(
	'Form payload { fields, parties, annexes } or checklist item values',
)

export const FillInputSchema = withSourceFields({
	data: FillDataSchema,
	evaluation_context: JsonObjectSchema.optional().describe('Fixed evaluation context from a previous draft'),
})
export type FillInput = z.infer<typeof FillInputSchema>

export const FillStateInputSchema = withSourceFields({
	data: FillDataSchema.optional().default({}),
	evaluation_context: JsonObjectSchema.optional(),
	include_optional: z.boolean().optional().default(false),
})
export type FillStateInput = z.infer<typeof FillStateInputSchema>

export const UpdateFillInputSchema = withSourceFields({
	data: FillDataSchema.describe('Current lossless form or checklist draft payload'),
	patch: FillDataSchema.optional().describe('Values to merge into the current draft'),
	clear: z.array(z.string().min(1)).optional().default([]).describe('Schema-qualified paths to clear'),
	reset: z.array(z.string().min(1)).optional().default([]).describe('Schema-qualified paths to reset'),
	evaluation_context: JsonObjectSchema.optional().describe('Fixed evaluation context from a previous draft'),
})
export type UpdateFillInput = z.infer<typeof UpdateFillInputSchema>

export const RenderInputSchema = withSourceFields({
	data: FillDataSchema.optional().describe('Form or checklist payload; documents do not require data'),
	evaluation_context: JsonObjectSchema.optional(),
	layer: z.string().optional().describe('Layer key; defaults to the artifact default layer'),
	presentation: z
		.object({
			max_bytes: z.number().int().positive().optional(),
			include_content: z.boolean().optional().default(true),
		})
		.optional()
		.describe('Optional model-facing output limit; application content remains available to the executor'),
})
export type RenderInput = z.infer<typeof RenderInputSchema>

export const ToolErrorSchema = z.object({
	code: z.string(),
	message: z.string(),
	path: z.array(z.union([z.string(), z.number()])).optional(),
	retryable: z.boolean().optional(),
})

export const ValidationIssueSchema = z.object({
	message: z.string(),
	path: z.array(z.union([z.string(), z.number()])).optional(),
})

export type ToolError = z.infer<typeof ToolErrorSchema>
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>

export type FormPayload = {
	fields: Record<string, unknown>
	parties?: Record<string, unknown>
	annexes?: Record<string, unknown>
	[key: string]: unknown
}

export type ChecklistPayload = Record<string, boolean | string>

export const RegistryItemSchema = z.object({ name: z.string(), path: z.string().optional() })
export type RegistryItem = z.infer<typeof RegistryItemSchema>

export const InstructionContentSchema = z.object({
	kind: z.enum(['inline', 'file']),
	mime_type: z.string().optional(),
	path: z.string().optional(),
	content: z.string(),
	encoding: z.enum(['utf-8', 'base64']),
})
export type InstructionContent = z.infer<typeof InstructionContentSchema>

export interface OperationDefinition<I, O> {
	name: string
	description: string
	input_schema: z.ZodType<I>
	output_schema: z.ZodType<O>
	execute: (input: I, config?: unknown) => Promise<O>
}

export const ValidateArtifactOutputSchema = z.object({
	valid: z.boolean(),
	artifact_kind: z.enum(['form', 'document', 'bundle', 'checklist']).optional(),
	issues: z.array(ValidationIssueSchema).optional(),
	error: ToolErrorSchema.optional(),
})

export const ValidateInputOutputSchema = z.object({
	valid: z.boolean(),
	target: ValidateInputTargetSchema,
	artifact_kind: z.enum(['form', 'document', 'bundle', 'checklist']).optional(),
	normalized_value: z.unknown().optional(),
	errors: z.array(ToolErrorSchema).optional(),
	error: ToolErrorSchema.optional(),
})

export const FillOutputSchema = z.object({
	accepted: z.boolean(),
	complete: z.boolean(),
	artifact_kind: z.enum(['form', 'checklist']).optional(),
	data: z.record(z.string(), z.unknown()).optional(),
	evaluation_context: z.record(z.string(), z.unknown()).optional(),
	errors: z.array(ToolErrorSchema).optional(),
	error: ToolErrorSchema.optional(),
})

/** Update returns the same lossless draft contract as fill. */
export const UpdateFillOutputSchema = FillOutputSchema

export const FillStateOutputSchema = z.object({
	artifact_kind: z.enum(['form', 'checklist']),
	phase: z.string(),
	summary: z.object({ required_total: z.number(), required_done: z.number(), required_remaining: z.number(), completion_percent: z.number() }),
	defs_values: z.record(z.string(), z.unknown()).optional(),
	rules: z.object({ valid: z.boolean(), errors: z.array(z.string()), warnings: z.array(z.string()) }),
	open_required: z.array(z.unknown()),
	open_optional: z.array(z.unknown()),
	blocked: z.array(z.unknown()),
	done: z.array(z.unknown()),
	candidates: z.array(z.unknown()),
	next: z.unknown().nullable(),
	evaluation_context: z.record(z.string(), z.unknown()).optional(),
	errors: z.array(ToolErrorSchema).optional(),
	error: ToolErrorSchema.optional(),
})

export const RenderOutputSchema = z.object({
	success: z.boolean(),
	artifact_kind: z.enum(['form', 'document', 'bundle', 'checklist']).optional(),
	content: z.string().optional(),
	encoding: z.enum(['utf-8', 'base64']).optional(),
	mime_type: z.string().optional(),
	byte_length: z.number().optional(),
	truncated: z.boolean().optional(),
	validation_issues: z.array(ValidationIssueSchema).optional(),
	errors: z.array(ToolErrorSchema).optional(),
	error: ToolErrorSchema.optional(),
})

export const GetRegistryOutputSchema = z.object({
	registry_url: z.string().optional(),
	artifacts_path: z.string().optional(),
	items: z.array(z.object({ name: z.string(), path: z.string().optional() })),
	error: ToolErrorSchema.optional(),
})

export const GetArtifactOutputSchema = z.object({
	artifact: z.record(z.string(), z.unknown()).optional(),
	artifact_name: z.string().optional(),
	base_url: z.string().optional(),
	instructions: InstructionContentSchema.optional(),
	agent_instructions: InstructionContentSchema.optional(),
	error: ToolErrorSchema.optional(),
})

export const InspectArtifactOutputSchema = z.object({
	artifact_kind: z.enum(['form', 'document', 'bundle', 'checklist']).optional(),
	name: z.string().optional(),
	version: z.string().optional(),
	title: z.string().optional(),
	description: z.string().optional(),
	sections: z.record(z.string(), z.unknown()),
	truncated: z.boolean(),
	error: ToolErrorSchema.optional(),
})

// Public result types are inferred from the same schemas exposed to adapters.
// Keeping these aliases beside the schema declarations prevents handwritten
// adapter contracts from drifting away from the neutral wire format.
export type ValidateArtifactOutput = z.infer<typeof ValidateArtifactOutputSchema>
export type ValidateInputOutput = z.infer<typeof ValidateInputOutputSchema>
export type FillOutput = z.infer<typeof FillOutputSchema>
export type FillStateOutput = z.infer<typeof FillStateOutputSchema>
export type UpdateFillOutput = z.infer<typeof UpdateFillOutputSchema>
export type RenderOutput = z.infer<typeof RenderOutputSchema>
export type GetRegistryOutput = z.infer<typeof GetRegistryOutputSchema>
export type GetArtifactOutput = z.infer<typeof GetArtifactOutputSchema>
export type InspectArtifactOutput = z.infer<typeof InspectArtifactOutputSchema>

export const operationNames = [
	'get_registry',
	'get_artifact',
	'inspect_artifact',
	'validate_artifact',
	'validate_input',
	'fill',
	'get_fill_state',
	'update_fill',
	'render',
] as const

export type OperationName = (typeof operationNames)[number]
