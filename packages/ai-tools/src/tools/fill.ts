import { isForm, isChecklist, loadFromObject, FormValidationError } from '@paradoc/sdk'
import type { FillInput } from '../schemas/fill'
import type { FillOutput } from '../types'
import type { ParadocToolsConfig } from '../config'
import { resolveSource } from '../resolve-source'

function extractErrors(error: Error): Array<{ field: string; message: string }> {
  if (error instanceof FormValidationError) {
    return error.errors.map((e) => ({
      field: e.field,
      message: e.message,
    }))
  }
  return [{ field: 'root', message: error.message }]
}

function normalizeParties(data: Record<string, unknown>): Record<string, unknown> {
  const partiesValue = data.parties
  if (!partiesValue || typeof partiesValue !== 'object' || Array.isArray(partiesValue)) {
    return data
  }

  const partiesRecord = partiesValue as Record<string, unknown>
  const normalizedParties: Record<string, unknown> = {}
  let mutated = false

  for (const [partyKey, partyValue] of Object.entries(partiesRecord)) {
    if (!partyValue || typeof partyValue !== 'object' || Array.isArray(partyValue)) {
      normalizedParties[partyKey] = partyValue
      continue
    }

    const partyObject = partyValue as Record<string, unknown>
    if (typeof partyObject.id === 'string' && partyObject.id.length > 0) {
      normalizedParties[partyKey] = partyObject
      continue
    }

    normalizedParties[partyKey] = { ...partyObject, id: `${partyKey}-0` }
    mutated = true
  }

  if (!mutated) return data
  return { ...data, parties: normalizedParties }
}

export async function executeFill(input: FillInput, config?: ParadocToolsConfig): Promise<FillOutput> {
  try {
    const { artifact } = await resolveSource(input, config)
    const data = normalizeParties(input.data as Record<string, unknown>)

    if (isForm(artifact)) {
      const instance = loadFromObject<'form'>(artifact)
      const result = instance.safeFill(data as Record<string, unknown>)

      return result.success
        ? {
            valid: true,
            artifactKind: 'form',
            data: result.data.getAllFields() as Record<string, unknown>,
          }
        : {
            valid: false,
            artifactKind: 'form',
            errors: extractErrors(result.error),
          }
    }

    if (isChecklist(artifact)) {
      const instance = loadFromObject<'checklist'>(artifact)
      const result = instance.safeFill(data as Record<string, boolean | string>)

      return result.success
        ? {
            valid: true,
            artifactKind: 'checklist',
            data: result.data.getAllItems() as Record<string, unknown>,
          }
        : {
            valid: false,
            artifactKind: 'checklist',
            errors: extractErrors(result.error),
          }
    }

    return {
      valid: false,
      error: 'Artifact must be a form or checklist to fill with data',
    }
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
