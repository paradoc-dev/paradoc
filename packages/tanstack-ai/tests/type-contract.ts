import type { InferToolInput, InferToolOutput } from '@tanstack/ai'
import {
	getRegistry,
	paradocTools,
	validateArtifact,
	validateInput,
} from '../src/index'

const registryInput: InferToolInput<ReturnType<typeof getRegistry>> = {}
void registryInput

const validateInputValue: InferToolInput<ReturnType<typeof validateInput>> = {
	source: 'artifact',
	artifact: {},
	target: 'field',
	field_path: 'name',
	value: 'Ada',
}
void validateInputValue

type ValidationResult = InferToolOutput<ReturnType<typeof validateArtifact>>
const validationResult: ValidationResult = { valid: true }
void validationResult

async function assertPreciseExecutionResult() {
	const result = await validateArtifact().execute!({ source: 'artifact', artifact: {} })
	const isValid: boolean = result.valid
	void isValid
	// @ts-expect-error Tool output must reject properties outside the shared result schema.
	const invalidContentLength = result.content_length
	void invalidContentLength
}

const tools = paradocTools()
const firstToolName: 'get_registry' = tools[0].name
const lastToolName: 'render' = tools[8].name
void firstToolName
void lastToolName
void assertPreciseExecutionResult
