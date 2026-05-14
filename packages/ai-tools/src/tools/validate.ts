import {
  isBundle,
  isChecklist,
  isDocument,
  isForm,
  validate,
} from '@paradoc/sdk'
import type { ValidateArtifactInput } from '../schemas/validate'
import type { ValidateOutput } from '../types'
import type { ParadocToolsConfig } from '../config'
import { resolveSource } from '../resolve-source'

export async function executeValidateArtifact(
  input: ValidateArtifactInput,
  config?: ParadocToolsConfig,
): Promise<ValidateOutput> {
  try {
    const { artifact } = await resolveSource(input, config)
    const { options } = input

    let detectedKind: ValidateOutput['detectedKind']
    if (isForm(artifact)) detectedKind = 'form'
    else if (isDocument(artifact)) detectedKind = 'document'
    else if (isBundle(artifact)) detectedKind = 'bundle'
    else if (isChecklist(artifact)) detectedKind = 'checklist'

    const result = validate(artifact, options)

    return result.issues
      ? {
          valid: false,
          detectedKind,
          issues: result.issues.map((issue) => ({
            message: issue.message,
            path: issue.path as (string | number)[] | undefined,
          })),
        }
      : { valid: true, detectedKind }
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
