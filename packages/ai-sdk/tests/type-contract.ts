import { paradocTools } from '../src/index'
import type { InferToolOutput } from 'ai'
import type { RenderOutput, ValidateArtifactOutput } from '../src/index'

const tools = paradocTools()

type ValidateResult = InferToolOutput<typeof tools.validate_artifact>
type RenderResult = InferToolOutput<typeof tools.render>

const validateOutput: ValidateArtifactOutput = {} as ValidateResult
const renderOutput: RenderOutput = {} as RenderResult

// These assignments are intentional compile-time guards for the published
// result types. A result must not grow an untyped catch-all property.
// @ts-expect-error Result types do not expose arbitrary properties.
const invalidValidateField = validateOutput.nonexistent
// @ts-expect-error Result types do not expose arbitrary properties.
const invalidRenderField = renderOutput.nonexistent

void invalidValidateField
void invalidRenderField
