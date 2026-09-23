import type { ValidateLayersResult } from '@paradoc/core'
import type { ParadocToolsConfig } from '../config'
import type { ValidateArtifactInput, ValidateArtifactOutput } from '../contracts'
import { artifactKind, makeResolver } from '../artifact'
import { errorFromUnknown } from '../errors'
import { normalizeValidateArtifactInput } from '../input'
import { resolveSource } from '../resolve-source'

export async function executeValidateArtifact(
	input: ValidateArtifactInput | Record<string, unknown>,
	config?: ParadocToolsConfig,
): Promise<ValidateArtifactOutput> {
	try {
		const { validate, validateLayers } = await import('@paradoc/core')
		const normalized = normalizeValidateArtifactInput(input)
		const { artifact, base_url } = await resolveSource(normalized, config)
		const kind = artifactKind(artifact)
		// File-backed layers resolve against the source's base URL; without one
		// only inline layers can be checked.
		const resolver = makeResolver(base_url, config)
		const result: ValidateLayersResult<unknown> = resolver
			? await validateLayers(artifact, { ...normalized.options, resolver })
			: validate(artifact, normalized.options)
		const toIssue = (issue: { message: string; path?: ReadonlyArray<unknown> }) =>
			({ message: issue.message, path: issue.path as Array<string | number> | undefined })
		const warnings = result.warnings ? { warnings: result.warnings.map(toIssue) } : {}
		if (result.issues) {
			return {
				valid: false,
				...(kind ? { artifact_kind: kind } : {}),
				issues: result.issues.map(toIssue),
				...warnings,
			}
		}
		return { valid: true, ...(kind ? { artifact_kind: kind } : {}), ...warnings }
	} catch (error) {
		return { valid: false, error: errorFromUnknown(error, 'validation_error') }
	}
}
