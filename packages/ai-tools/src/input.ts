import type {
	FillInput,
	FillStateInput,
	GetArtifactInput,
	GetRegistryInput,
	InspectArtifactInput,
	RenderInput,
	SourceInput,
	UpdateFillInput,
	ValidateArtifactInput,
	ValidateInputValue,
} from './contracts'

type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord {
	return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as UnknownRecord) } : {}
}

/** Clone model/provider input at the execution boundary without changing its canonical wire names. */
export function normalizeInput<T extends UnknownRecord>(input: T): T {
	return record(input) as T
}

export function normalizeSource(input: SourceInput | UnknownRecord): SourceInput {
	return normalizeInput(input) as unknown as SourceInput
}

export function normalizeGetRegistryInput(input: GetRegistryInput | UnknownRecord): GetRegistryInput {
	return normalizeInput(input) as unknown as GetRegistryInput
}

export function normalizeGetArtifactInput(input: GetArtifactInput | UnknownRecord): GetArtifactInput {
	return normalizeInput(input) as unknown as GetArtifactInput
}

export function normalizeInspectArtifactInput(input: InspectArtifactInput | UnknownRecord): InspectArtifactInput {
	return normalizeInput(input) as unknown as InspectArtifactInput
}

export function normalizeValidateArtifactInput(input: ValidateArtifactInput | UnknownRecord): ValidateArtifactInput {
	return normalizeInput(input) as unknown as ValidateArtifactInput
}

export function normalizeValidateInput(input: ValidateInputValue | UnknownRecord): ValidateInputValue {
	return normalizeInput(input) as unknown as ValidateInputValue
}

export function normalizeFillInput(input: FillInput | UnknownRecord): FillInput {
	return normalizeInput(input) as unknown as FillInput
}

export function normalizeFillStateInput(input: FillStateInput | UnknownRecord): FillStateInput {
	return normalizeInput(input) as unknown as FillStateInput
}

export function normalizeUpdateFillInput(input: UpdateFillInput | UnknownRecord): UpdateFillInput {
	return normalizeInput(input) as unknown as UpdateFillInput
}

export function normalizeRenderInput(input: RenderInput | UnknownRecord): RenderInput {
	return normalizeInput(input) as unknown as RenderInput
}
