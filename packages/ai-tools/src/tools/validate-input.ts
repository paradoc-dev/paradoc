import {
  isForm,
  isChecklist,
  isDocument,
  isBundle,
  loadFromObject,
} from '@paradoc/sdk'
import type { ValidateInputValue } from '../schemas/validate-input'
import type { ValidateInputValueOutput } from '../types'
import type { ParadocToolsConfig } from '../config'
import { resolveSource } from '../resolve-source'
import { executeFill } from './fill'

type ValidationError = { field: string; message: string }
type ProgressiveValidationResult<T> =
  | { success: true; value: T }
  | { success: false; errors: ValidationError[] }

type ValidateFieldInputMethod = (input: {
  fieldPath: string
  value: unknown
}) => ProgressiveValidationResult<unknown>

type ValidatePartyInputMethod = (input: {
  roleId: string
  index?: number
  value: unknown
}) => ProgressiveValidationResult<{
  roleId: string
  index: number
  party: Record<string, unknown>
}>

type ValidateAnnexInputMethod = (input: {
  annexId: string
  value: unknown
}) => ProgressiveValidationResult<unknown>

type ValidateChecklistItemInputMethod = (input: {
  itemId: string
  value: unknown
}) => ProgressiveValidationResult<boolean | string>

function detectArtifactKind(
  artifact: Record<string, unknown>,
): ValidateInputValueOutput['artifactKind'] | undefined {
  if (isForm(artifact)) return 'form'
  if (isChecklist(artifact)) return 'checklist'
  if (isDocument(artifact)) return 'document'
  if (isBundle(artifact)) return 'bundle'
  return undefined
}

function targetError(
  target: ValidateInputValue['target'],
  artifactKind: ValidateInputValueOutput['artifactKind'],
  message: string,
): ValidateInputValueOutput {
  return {
    valid: false,
    target,
    artifactKind,
    errors: [{ field: 'target', message }],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasValidateFieldInput(value: unknown): value is { validateFieldInput: ValidateFieldInputMethod } {
  return isRecord(value) && typeof value.validateFieldInput === 'function'
}

function hasValidatePartyInput(value: unknown): value is { validatePartyInput: ValidatePartyInputMethod } {
  return isRecord(value) && typeof value.validatePartyInput === 'function'
}

function hasValidateAnnexInput(value: unknown): value is { validateAnnexInput: ValidateAnnexInputMethod } {
  return isRecord(value) && typeof value.validateAnnexInput === 'function'
}

function hasValidateChecklistItemInput(
  value: unknown,
): value is { validateItemInput: ValidateChecklistItemInputMethod } {
  return isRecord(value) && typeof value.validateItemInput === 'function'
}

function splitPath(path: string): string[] {
  return path
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
}

function getNestedValue(value: unknown, pathSegments: string[]): unknown {
  let current = value
  for (const segment of pathSegments) {
    if (!isRecord(current)) return undefined
    current = current[segment]
  }
  return current
}

function setNestedValue(
  target: Record<string, unknown>,
  pathSegments: string[],
  value: unknown,
): void {
  let cursor = target
  for (let i = 0; i < pathSegments.length; i += 1) {
    const segment = pathSegments[i]!
    const isLeaf = i === pathSegments.length - 1

    if (isLeaf) {
      cursor[segment] = value
      return
    }

    const next = cursor[segment]
    if (!isRecord(next)) {
      cursor[segment] = {}
    }
    cursor = cursor[segment] as Record<string, unknown>
  }
}

function findFieldDefinition(
  artifact: Record<string, unknown>,
  fieldPath: string,
): Record<string, unknown> | undefined {
  const segments = splitPath(fieldPath)
  if (segments.length === 0) return undefined

  const fieldsRoot = artifact.fields
  if (!isRecord(fieldsRoot)) return undefined

  let currentFields: Record<string, unknown> = fieldsRoot
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i]!
    const isLeaf = i === segments.length - 1
    const field = currentFields[segment]

    if (!isRecord(field)) return undefined
    if (isLeaf) return field

    if (field.type !== 'fieldset' || !isRecord(field.fields)) {
      return undefined
    }
    currentFields = field.fields
  }

  return undefined
}

function getPartyDefinition(
  artifact: Record<string, unknown>,
  roleId: string,
): Record<string, unknown> | undefined {
  const parties = artifact.parties
  if (!isRecord(parties)) return undefined
  const party = parties[roleId]
  if (!isRecord(party)) return undefined
  return party
}

function getChecklistItemDefinition(
  artifact: Record<string, unknown>,
  itemId: string,
): Record<string, unknown> | undefined {
  const items = artifact.items
  if (!Array.isArray(items)) return undefined
  const found = items.find((item) => isRecord(item) && item.id === itemId)
  return isRecord(found) ? found : undefined
}

function matchesErrorPrefix(field: string, prefix: string): boolean {
  return (
    field === prefix
    || field.startsWith(`${prefix}.`)
    || field.startsWith(`${prefix}[`)
  )
}

function selectTargetErrors(errors: ValidationError[], prefixes: string[]): ValidationError[] {
  return errors.filter((error) => prefixes.some((prefix) => matchesErrorPrefix(error.field, prefix)))
}

function normalizePartyValue(
  roleId: string,
  index: number,
  value: unknown,
): { ok: true; party: Record<string, unknown> } | { ok: false; error: ValidationError } {
  if (!isRecord(value)) {
    return {
      ok: false,
      error: {
        field: `parties.${roleId}`,
        message: 'Party value must be an object.',
      },
    }
  }

  const party = { ...value }
  const currentId = party.id
  if (typeof currentId !== 'string' || currentId.trim().length === 0) {
    party.id = `${roleId}-${index}`
  }

  return { ok: true, party }
}

async function fallbackValidateField(
  artifact: Record<string, unknown>,
  fieldPath: string,
  value: unknown,
  config?: ParadocToolsConfig,
): Promise<ValidateInputValueOutput> {
  const segments = splitPath(fieldPath)
  const fieldsPatch: Record<string, unknown> = {}
  setNestedValue(fieldsPatch, segments, value)

  const fillResult = await executeFill(
    {
      source: 'artifact',
      artifact,
      data: { fields: fieldsPatch },
    },
    config,
  )

  if (fillResult.valid) {
    return {
      valid: true,
      target: 'field',
      artifactKind: 'form',
      normalizedValue: getNestedValue(fillResult.data ?? {}, segments),
    }
  }

  if (fillResult.error) {
    return {
      valid: false,
      target: 'field',
      artifactKind: 'form',
      errors: [{ field: 'root', message: fillResult.error }],
    }
  }

  const errors = fillResult.errors ?? []
  const targetErrors = selectTargetErrors(errors, [`fields.${fieldPath}`])
  if (targetErrors.length > 0) {
    return {
      valid: false,
      target: 'field',
      artifactKind: 'form',
      errors: targetErrors,
    }
  }

  return {
    valid: true,
    target: 'field',
    artifactKind: 'form',
    normalizedValue: value,
  }
}

async function fallbackValidateParty(
  artifact: Record<string, unknown>,
  roleId: string,
  index: number,
  value: unknown,
  max: number,
  config?: ParadocToolsConfig,
): Promise<ValidateInputValueOutput> {
  const normalized = normalizePartyValue(roleId, index, value)
  if (!normalized.ok) {
    return {
      valid: false,
      target: 'party',
      artifactKind: 'form',
      errors: [normalized.error],
    }
  }

  const partyValue = normalized.party
  const partiesPatch: Record<string, unknown> = {}
  if (max > 1) {
    const roleArray: Record<string, unknown>[] = []
    for (let i = 0; i <= index; i += 1) {
      roleArray[i] = i === index ? partyValue : { ...partyValue, id: `${roleId}-${i}` }
    }
    partiesPatch[roleId] = roleArray
  } else {
    partiesPatch[roleId] = partyValue
  }

  const fillResult = await executeFill(
    {
      source: 'artifact',
      artifact,
      data: { parties: partiesPatch },
    },
    config,
  )

  if (fillResult.error) {
    return {
      valid: false,
      target: 'party',
      artifactKind: 'form',
      errors: [{ field: 'root', message: fillResult.error }],
    }
  }

  const errors = fillResult.errors ?? []
  const targetErrors = selectTargetErrors(errors, [`parties.${roleId}`])
  if (targetErrors.length > 0) {
    return {
      valid: false,
      target: 'party',
      artifactKind: 'form',
      errors: targetErrors,
    }
  }

  return {
    valid: true,
    target: 'party',
    artifactKind: 'form',
    normalizedValue: {
      roleId,
      index,
      party: partyValue,
    },
  }
}

async function fallbackValidateChecklistItem(
  artifact: Record<string, unknown>,
  itemId: string,
  value: unknown,
  config?: ParadocToolsConfig,
): Promise<ValidateInputValueOutput> {
  const fillResult = await executeFill(
    {
      source: 'artifact',
      artifact,
      data: { [itemId]: value },
    },
    config,
  )

  if (fillResult.valid) {
    return {
      valid: true,
      target: 'checklistItem',
      artifactKind: 'checklist',
      normalizedValue: fillResult.data?.[itemId],
    }
  }

  if (fillResult.error) {
    return {
      valid: false,
      target: 'checklistItem',
      artifactKind: 'checklist',
      errors: [{ field: 'root', message: fillResult.error }],
    }
  }

  const errors = fillResult.errors ?? []
  const targetErrors = selectTargetErrors(errors, [itemId, `items.${itemId}`])
  if (targetErrors.length > 0) {
    return {
      valid: false,
      target: 'checklistItem',
      artifactKind: 'checklist',
      errors: targetErrors,
    }
  }

  return {
    valid: true,
    target: 'checklistItem',
    artifactKind: 'checklist',
    normalizedValue: value,
  }
}

export async function executeValidateInput(
  input: ValidateInputValue,
  config?: ParadocToolsConfig,
): Promise<ValidateInputValueOutput> {
  try {
    const { artifact } = await resolveSource(input, config)
    const artifactKind = detectArtifactKind(artifact)

    if (input.target === 'field') {
      if (!isForm(artifact)) {
        return targetError(
          input.target,
          artifactKind,
          'Target "field" requires a form artifact.',
        )
      }
      if (!input.fieldPath || input.fieldPath.trim().length === 0) {
        return {
          valid: false,
          target: input.target,
          artifactKind: 'form',
          errors: [{ field: 'fieldPath', message: 'fieldPath is required for target "field".' }],
        }
      }
      const fieldPath = input.fieldPath.trim()
      if (!findFieldDefinition(artifact, fieldPath)) {
        return {
          valid: false,
          target: 'field',
          artifactKind: 'form',
          errors: [{ field: `fields.${fieldPath}`, message: `Unknown field path "${fieldPath}".` }],
        }
      }

      const instance = loadFromObject<'form'>(artifact)
      if (hasValidateFieldInput(instance)) {
        const result = instance.validateFieldInput({
          fieldPath,
          value: input.value,
        })

        return result.success
          ? {
              valid: true,
              target: input.target,
              artifactKind: 'form',
              normalizedValue: result.value,
            }
          : {
              valid: false,
              target: input.target,
              artifactKind: 'form',
              errors: result.errors,
            }
      }

      return fallbackValidateField(artifact, fieldPath, input.value, config)
    }

    if (input.target === 'party') {
      if (!isForm(artifact)) {
        return targetError(
          input.target,
          artifactKind,
          'Target "party" requires a form artifact.',
        )
      }
      if (!input.roleId || input.roleId.trim().length === 0) {
        return {
          valid: false,
          target: input.target,
          artifactKind: 'form',
          errors: [{ field: 'roleId', message: 'roleId is required for target "party".' }],
        }
      }
      const roleId = input.roleId.trim()
      const partyDefinition = getPartyDefinition(artifact, roleId)
      if (!partyDefinition) {
        return {
          valid: false,
          target: 'party',
          artifactKind: 'form',
          errors: [{ field: `parties.${roleId}`, message: `Unknown party role "${roleId}".` }],
        }
      }

      const index = input.index ?? 0
      const max = typeof partyDefinition.max === 'number' && partyDefinition.max > 0
        ? partyDefinition.max
        : 1
      if (max <= 1 && index !== 0) {
        return {
          valid: false,
          target: 'party',
          artifactKind: 'form',
          errors: [{
            field: `parties.${roleId}[${index}]`,
            message: `Role "${roleId}" accepts a single party; only index 0 is valid.`,
          }],
        }
      }
      if (max > 1 && index >= max) {
        return {
          valid: false,
          target: 'party',
          artifactKind: 'form',
          errors: [{
            field: `parties.${roleId}[${index}]`,
            message: `Role "${roleId}" allows at most ${max} parties. Highest valid index is ${max - 1}.`,
          }],
        }
      }

      const instance = loadFromObject<'form'>(artifact)
      if (hasValidatePartyInput(instance)) {
        const result = instance.validatePartyInput({
          roleId,
          index,
          value: input.value,
        })

        return result.success
          ? {
              valid: true,
              target: input.target,
              artifactKind: 'form',
              normalizedValue: result.value,
            }
          : {
              valid: false,
              target: input.target,
              artifactKind: 'form',
              errors: result.errors,
            }
      }

      return fallbackValidateParty(artifact, roleId, index, input.value, max, config)
    }

    if (input.target === 'annex') {
      if (!isForm(artifact)) {
        return targetError(
          input.target,
          artifactKind,
          'Target "annex" requires a form artifact.',
        )
      }
      if (!input.annexId || input.annexId.trim().length === 0) {
        return {
          valid: false,
          target: input.target,
          artifactKind: 'form',
          errors: [{ field: 'annexId', message: 'annexId is required for target "annex".' }],
        }
      }
      const annexId = input.annexId.trim()
      const instance = loadFromObject<'form'>(artifact)
      if (hasValidateAnnexInput(instance)) {
        const result = instance.validateAnnexInput({
          annexId,
          value: input.value,
        })

        return result.success
          ? {
              valid: true,
              target: input.target,
              artifactKind: 'form',
              normalizedValue: result.value,
            }
          : {
              valid: false,
              target: input.target,
              artifactKind: 'form',
              errors: result.errors,
            }
      }

      const annexes = artifact.annexes
      const allowAdditionalAnnexes = artifact.allowAdditionalAnnexes === true
      if (!allowAdditionalAnnexes && (!isRecord(annexes) || !annexes[annexId])) {
        return {
          valid: false,
          target: 'annex',
          artifactKind: 'form',
          errors: [{ field: `annexes.${annexId}`, message: `Unknown annex "${annexId}".` }],
        }
      }
      return {
        valid: true,
        target: 'annex',
        artifactKind: 'form',
        normalizedValue: input.value,
      }
    }

    if (input.target === 'checklistItem') {
      if (!isChecklist(artifact)) {
        return targetError(
          input.target,
          artifactKind,
          'Target "checklistItem" requires a checklist artifact.',
        )
      }
      if (!input.itemId || input.itemId.trim().length === 0) {
        return {
          valid: false,
          target: input.target,
          artifactKind: 'checklist',
          errors: [{ field: 'itemId', message: 'itemId is required for target "checklistItem".' }],
        }
      }
      const itemId = input.itemId.trim()
      if (!getChecklistItemDefinition(artifact, itemId)) {
        return {
          valid: false,
          target: 'checklistItem',
          artifactKind: 'checklist',
          errors: [{ field: `items.${itemId}`, message: `Unknown item "${itemId}".` }],
        }
      }

      const instance = loadFromObject<'checklist'>(artifact)
      if (hasValidateChecklistItemInput(instance)) {
        const result = instance.validateItemInput({
          itemId,
          value: input.value,
        })

        return result.success
          ? {
              valid: true,
              target: input.target,
              artifactKind: 'checklist',
              normalizedValue: result.value,
            }
          : {
              valid: false,
              target: input.target,
              artifactKind: 'checklist',
              errors: result.errors,
            }
      }

      return fallbackValidateChecklistItem(artifact, itemId, input.value, config)
    }

    return {
      valid: false,
      target: input.target,
      artifactKind,
      errors: [{ field: 'target', message: `Unsupported target "${input.target}".` }],
    }
  } catch (err) {
    return {
      valid: false,
      target: input.target,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
