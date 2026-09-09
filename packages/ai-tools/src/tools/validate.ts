import type { ParadocToolsConfig } from '../config'
import type { ValidateArtifactInput, ValidateArtifactOutput } from '../contracts'
import { artifactKind } from '../artifact'
import { errorFromUnknown } from '../errors'
import { normalizeValidateArtifactInput } from '../input'
import { resolveSource } from '../resolve-source'

export async function executeValidateArtifact(
	input: ValidateArtifactInput | Record<string, unknown>,
	config?: ParadocToolsConfig,
): Promise<ValidateArtifactOutput> {
	try {
		const { validate } = await import('@paradoc/core')
		const normalized = normalizeValidateArtifactInput(input)
		const { artifact } = await resolveSource(normalized, config)
		const kind = artifactKind(artifact)
		const result = validate(artifact, normalized.options)
		if (result.issues) {
			return {
				valid: false,
				...(kind ? { artifact_kind: kind } : {}),
				issues: result.issues.map((issue) => ({ message: issue.message, path: issue.path as Array<string | number> | undefined })),
			}
		}
		return { valid: true, ...(kind ? { artifact_kind: kind } : {}) }
	} catch (error) {
		return { valid: false, error: errorFromUnknown(error, 'validation_error') }
	}
}
