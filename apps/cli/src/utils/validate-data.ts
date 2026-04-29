/**
 * CLI utility for validating form data.
 * This is a CLI-specific implementation since validateInstance is not exported from @paradoc/core.
 */

import type { Form, FormField, FormAnnex } from '@paradoc/core'

export interface ValidationError {
  field: string
  message: string
  value?: unknown
}

export interface ValidationResult {
  success: boolean
  data?: Record<string, unknown>
  errors: ValidationError[]
}

export interface InstanceData {
  fields: Record<string, unknown>
  annexes?: Record<string, unknown>
}

/**
 * Validate field data against field definition
 */
function validateFieldValue(fieldId: string, field: FormField, value: unknown): ValidationError | null {
  // Check required
  const isRequired = field.required === true
  const isEmpty = value === undefined || value === null || value === ''

  if (isRequired && isEmpty) {
    return {
      field: `fields.${fieldId}`,
      message: `Field "${field.label || fieldId}" is required`,
      value,
    }
  }

  // Skip further validation if empty and not required
  if (isEmpty) {
    return null
  }

  // Type-specific validation
  switch (field.type) {
    case 'text':
    case 'email':
    case 'uri':
    case 'uuid':
      if (typeof value !== 'string') {
        return {
          field: `fields.${fieldId}`,
          message: `Expected string for "${field.label || fieldId}"`,
          value,
        }
      }
      if ('minLength' in field && field.minLength !== undefined && value.length < field.minLength) {
        return {
          field: `fields.${fieldId}`,
          message: `"${field.label || fieldId}" must be at least ${field.minLength} characters`,
          value,
        }
      }
      if ('maxLength' in field && field.maxLength !== undefined && value.length > field.maxLength) {
        return {
          field: `fields.${fieldId}`,
          message: `"${field.label || fieldId}" must be at most ${field.maxLength} characters`,
          value,
        }
      }
      break

    case 'number':
    case 'percentage':
    case 'rating':
      if (typeof value !== 'number') {
        return {
          field: `fields.${fieldId}`,
          message: `Expected number for "${field.label || fieldId}"`,
          value,
        }
      }
      if ('min' in field && field.min !== undefined && value < field.min) {
        return {
          field: `fields.${fieldId}`,
          message: `"${field.label || fieldId}" must be at least ${field.min}`,
          value,
        }
      }
      if ('max' in field && field.max !== undefined && value > field.max) {
        return {
          field: `fields.${fieldId}`,
          message: `"${field.label || fieldId}" must be at most ${field.max}`,
          value,
        }
      }
      break

    case 'boolean':
      if (typeof value !== 'boolean') {
        return {
          field: `fields.${fieldId}`,
          message: `Expected boolean for "${field.label || fieldId}"`,
          value,
        }
      }
      break

    case 'enum':
      if (!field.enum.includes(value as string | number)) {
        return {
          field: `fields.${fieldId}`,
          message: `"${field.label || fieldId}" must be one of: ${field.enum.join(', ')}`,
          value,
        }
      }
      break

    case 'multiselect':
      if (!Array.isArray(value)) {
        return {
          field: `fields.${fieldId}`,
          message: `Expected array for "${field.label || fieldId}"`,
          value,
        }
      }
      for (const item of value) {
        if (!field.enum.includes(item as string | number)) {
          return {
            field: `fields.${fieldId}`,
            message: `Invalid option in "${field.label || fieldId}": ${item}`,
            value,
          }
        }
      }
      break

    // For complex types, just check it's an object
    case 'coordinate':
    case 'bbox':
    case 'money':
    case 'address':
    case 'phone':
    case 'person':
    case 'organization':
    case 'identification':
      if (typeof value !== 'object' || value === null) {
        return {
          field: `fields.${fieldId}`,
          message: `Expected object for "${field.label || fieldId}"`,
          value,
        }
      }
      break

    case 'fieldset':
      if (typeof value !== 'object' || value === null) {
        return {
          field: `fields.${fieldId}`,
          message: `Expected object for fieldset "${field.label || fieldId}"`,
          value,
        }
      }
      // Recursively validate nested fields
      if (field.fields) {
        for (const [nestedId, nestedField] of Object.entries(field.fields)) {
          const nestedValue = (value as Record<string, unknown>)[nestedId]
          const error = validateFieldValue(`${fieldId}.${nestedId}`, nestedField, nestedValue)
          if (error) {
            return error
          }
        }
      }
      break
  }

  return null
}

/**
 * Validate instance data against a form definition.
 */
export function validateInstanceData(form: Form, data: InstanceData): ValidationResult {
  const errors: ValidationError[] = []

  // Validate fields
  if (form.fields) {
    for (const [fieldId, field] of Object.entries(form.fields)) {
      const value = data.fields[fieldId]
      const error = validateFieldValue(fieldId, field, value)
      if (error) {
        errors.push(error)
      }
    }
  }

  // Validate annexes if form has required annexes
  if (form.annexes) {
    for (const [annexId, annex] of Object.entries(form.annexes) as [string, FormAnnex][]) {
      const annexValue = data.annexes?.[annexId]
      // Check if annex is required (boolean only, not expression)
      const isRequired = annex.required === true
      if (isRequired && (annexValue === undefined || annexValue === null)) {
        errors.push({
          field: `annexes.${annexId}`,
          message: `Annex "${annex.title || annexId}" is required`,
        })
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, errors }
  }

  return {
    success: true,
    data: data.fields,
    errors: [],
  }
}
