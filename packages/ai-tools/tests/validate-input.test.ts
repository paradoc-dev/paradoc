import { describe, it, expect } from 'vitest'
import { executeValidateInput } from '../src/tools/validate-input'

describe('executeValidateInput', () => {
  const formArtifact = {
    kind: 'form' as const,
    name: 'pet-form',
    fields: {
      species: {
        type: 'enum' as const,
        label: 'Species',
        required: true,
        enum: ['dog', 'cat', 'fish'],
      },
      profile: {
        type: 'fieldset' as const,
        label: 'Profile',
        fields: {
          nickname: {
            type: 'text' as const,
            label: 'Nickname',
            minLength: 2,
          },
        },
      },
    },
    parties: {
      tenant: {
        label: 'Tenant',
        partyType: 'person' as const,
      },
    },
    annexes: {
      petPhoto: {
        title: 'Pet photo',
      },
    },
  }

  const checklistArtifact = {
    kind: 'checklist' as const,
    name: 'move-in-checklist',
    items: [
      { id: 'reviewed', title: 'Reviewed', status: { kind: 'boolean' as const } },
      {
        id: 'approval',
        title: 'Approval',
        status: {
          kind: 'enum' as const,
          options: [
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
          ],
        },
      },
    ],
  }

  it('validates a form field value', async () => {
    const result = await executeValidateInput({
      source: 'artifact',
      artifact: formArtifact,
      target: 'field',
      fieldPath: 'species',
      value: 'cat',
    })

    expect(result.valid).toBe(true)
    expect(result.target).toBe('field')
    expect(result.artifactKind).toBe('form')
    expect(result.normalizedValue).toBe('cat')
  })

  it('returns field errors for invalid form field value', async () => {
    const result = await executeValidateInput({
      source: 'artifact',
      artifact: formArtifact,
      target: 'field',
      fieldPath: 'species',
      value: 'shark',
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors![0]!.field).toBe('fields.species')
  })

  it('normalizes party id for party validation', async () => {
    const result = await executeValidateInput({
      source: 'artifact',
      artifact: formArtifact,
      target: 'party',
      roleId: 'tenant',
      value: {
        name: 'John Smith',
      },
    })

    expect(result.valid).toBe(true)
    expect(result.target).toBe('party')
    expect(result.artifactKind).toBe('form')
    expect(result.normalizedValue).toEqual({
      roleId: 'tenant',
      index: 0,
      party: {
        id: 'tenant-0',
        name: 'John Smith',
      },
    })
  })

  it('validates checklist item input', async () => {
    const result = await executeValidateInput({
      source: 'artifact',
      artifact: checklistArtifact,
      target: 'checklistItem',
      itemId: 'approval',
      value: 'approved',
    })

    expect(result.valid).toBe(true)
    expect(result.target).toBe('checklistItem')
    expect(result.artifactKind).toBe('checklist')
    expect(result.normalizedValue).toBe('approved')
  })

  it('returns target mismatch error when using checklist target on form', async () => {
    const result = await executeValidateInput({
      source: 'artifact',
      artifact: formArtifact,
      target: 'checklistItem',
      itemId: 'approval',
      value: 'approved',
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      {
        field: 'target',
        message: 'Target "checklistItem" requires a checklist artifact.',
      },
    ])
  })

  it('returns required selector error when fieldPath is missing', async () => {
    const result = await executeValidateInput({
      source: 'artifact',
      artifact: formArtifact,
      target: 'field',
      value: 'cat',
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      {
        field: 'fieldPath',
        message: 'fieldPath is required for target "field".',
      },
    ])
  })
})
