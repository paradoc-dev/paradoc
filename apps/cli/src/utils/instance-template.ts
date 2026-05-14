/**
 * CLI utility for generating instance templates from form artifacts.
 * This is a CLI-specific implementation that doesn't modify core packages.
 */

import type { Form, FormField } from '@paradoc/core'

/**
 * Instance template structure for form data
 */
export interface InstanceTemplate {
  fields: Record<string, unknown>
  annexes?: Record<string, unknown>
}

/**
 * Get the default value for a field based on its type
 */
function getFieldDefault(field: FormField): unknown {
  // Return explicit default if set
  if ('default' in field && field.default !== undefined) {
    return field.default
  }

  // Return type-appropriate empty/default value
  switch (field.type) {
    case 'text':
    case 'email':
    case 'uri':
    case 'uuid':
    case 'date':
    case 'datetime':
    case 'time':
      return ''

    case 'boolean':
      return false

    case 'number':
    case 'percentage':
    case 'rating':
      return null

    case 'enum':
      // Default to first option if available
      return field.enum && field.enum.length > 0 ? field.enum[0] : null

    case 'multiselect':
      return []

    case 'coordinate':
      return { lat: 0, lng: 0 }

    case 'bbox':
      return { north: 0, south: 0, east: 0, west: 0 }

    case 'money':
      return { amount: 0, currency: 'USD' }

    case 'address':
      return {
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      }

    case 'phone':
      return { number: '' }

    case 'duration':
      return 'PT0S'

    case 'person':
      return {
        firstName: '',
        lastName: '',
      }

    case 'organization':
      return {
        name: '',
      }

    case 'identification':
      return {
        type: '',
        number: '',
      }

    case 'fieldset':
      // Recursively process nested fields
      return generateFieldsTemplate(field.fields)

    default:
      return null
  }
}

/**
 * Generate template values for a record of fields
 */
function generateFieldsTemplate(fields: Record<string, FormField>): Record<string, unknown> {
  const template: Record<string, unknown> = {}

  for (const [fieldId, field] of Object.entries(fields)) {
    template[fieldId] = getFieldDefault(field)
  }

  return template
}

/**
 * Generate an instance template from a form artifact.
 * Creates a data structure with default/empty values for all fields.
 *
 * @param form - The form artifact to generate a template for
 * @returns An instance template with fields and optional annexes
 */
export function makeInstanceTemplate(form: Form): InstanceTemplate {
  const template: InstanceTemplate = {
    fields: {},
  }

  // Generate field defaults
  if (form.fields) {
    template.fields = generateFieldsTemplate(form.fields)
  }

  // Generate annex placeholders if annexes are defined
  if (form.annexes && Object.keys(form.annexes).length > 0) {
    template.annexes = {}
    for (const annexId of Object.keys(form.annexes)) {
      template.annexes[annexId] = null
    }
  }

  return template
}
