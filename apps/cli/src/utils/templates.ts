import slugify from 'slugify'
import { PARADOC_SCHEMA_URL } from '@paradoc/core'
import { FORM_FIELD_TYPES, SCHEMA_BASE, type FormFieldType } from '@paradoc/schemas'

export interface ManifestTemplate {
  $schema: string
  name: string
  title: string
  description: string
  visibility: 'public' | 'private'
}

export interface ArtifactTemplate {
  /** The current dated schema address */
  $schema: string
  kind: string
  name: string
  title: string
  description?: string
  code?: string
  version?: string
  metadata?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * Generate paradoc.json manifest template (new format)
 */
export function generateManifestTemplate(
  title: string,
  options: {
    description?: string
    visibility?: 'public' | 'private'
    org?: string
  } = {}
): ManifestTemplate {
  const slug = slugify(title, { lower: true, strict: true, trim: true })
  const org = options.org || 'your-org'

  return {
    $schema: `${SCHEMA_BASE}/manifest.json`,
    name: `@${org}/${slug}`,
    title,
    description: options.description || '',
    visibility: options.visibility || 'private',
  }
}

/**
 * Generate bundle template
 */
export function generateBundleTemplate(
  slug: string,
  title: string,
  options: {
    description?: string
    code?: string
    version?: string
    contents?: unknown[]
  } = {}
): ArtifactTemplate {
  return {
    $schema: PARADOC_SCHEMA_URL,
    kind: 'bundle',
    name: slug,
    title,
    description: options.description,
    code: options.code,
    version: options.version || '1.0.0',
    contents: options.contents || [],
  }
}

/**
 * Generate document template
 */
export function generateDocumentTemplate(
  slug: string,
  title: string,
  options: {
    description?: string
    code?: string
    version?: string
    layers?: Record<string, unknown>
    defaultLayer?: string
  } = {}
): ArtifactTemplate {
  return {
    $schema: PARADOC_SCHEMA_URL,
    kind: 'document',
    name: slug,
    title,
    description: options.description,
    code: options.code,
    version: options.version || '1.0.0',
    layers: options.layers || {},
    defaultLayer: options.defaultLayer,
  }
}

/**
 * Generate form template
 */
export function generateFormTemplate(
  slug: string,
  title: string,
  options: {
    description?: string
    code?: string
    version?: string
    fields?: Record<string, unknown>
  } = {}
): ArtifactTemplate {
  return {
    $schema: PARADOC_SCHEMA_URL,
    kind: 'form',
    name: slug,
    title,
    description: options.description,
    code: options.code,
    version: options.version || '1.0.0',
    fields: options.fields || {},
  }
}

/**
 * Generate checklist template
 */
export function generateChecklistTemplate(
  slug: string,
  title: string,
  options: {
    description?: string
    code?: string
    version?: string
    items?: unknown[]
  } = {}
): ArtifactTemplate {
  return {
    $schema: PARADOC_SCHEMA_URL,
    kind: 'checklist',
    name: slug,
    title,
    description: options.description,
    code: options.code,
    version: options.version || '1.0.0',
    items: options.items || [],
  }
}


/**
 * Parse field definition from CLI format (name:type)
 */
export function parseFieldDefinition(fieldDef: string): {
  name: string
  type: string
} {
  const [name, type = 'text'] = fieldDef.split(':')
  return { name: (name || 'field').trim(), type: type.trim() }
}

/**
 * Whether a string is a field type the schema accepts.
 */
export function isValidFieldType(type: string): type is FormFieldType {
  return (FORM_FIELD_TYPES as readonly string[]).includes(type)
}

/**
 * Create a field object from name and type.
 *
 * `type` must be a value from `FORM_FIELD_TYPES` (checked by the caller); the
 * result always passes `paradoc validate` on its own, so every type that
 * requires more than `type`/`label` is scaffolded with the keys it needs.
 */
export function createField(name: string, type: FormFieldType): Record<string, unknown> {
  const field: Record<string, unknown> = {
    type,
    label: name
      .split(/(?=[A-Z])/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' '),
  }

  // Add common field properties based on type
  if (type === 'text' || type === 'email') {
    field.required = false
  }

  if (type === 'enum' || type === 'multiselect') {
    field.enum = [
      { value: 'option_one', label: 'Option One' },
      { value: 'option_two', label: 'Option Two' },
    ]
  }

  if (type === 'fieldset') {
    field.fields = {}
  }

  if (type === 'list') {
    field.item = { type: 'text' }
  }

  return field
}

/**
 * Create a checklist item from text
 */
export function createChecklistItem(text: string, index: number): Record<string, unknown> {
  return {
    id: `item-${index + 1}`,
    title: text,
    status: {
      kind: 'boolean',
      default: false,
    },
  }
}
