import slugify from 'slugify'

export interface ProjectTemplate {
  name: string
  slug: string
  description?: string
  version: string
  artifacts: {
    forms: string[]
    documents: string[]
    checklists: string[]
    bundles: string[]
  }
  metadata?: Record<string, unknown>
}

export interface ManifestTemplate {
  $schema: string
  name: string
  title: string
  description: string
  visibility: 'public' | 'private'
}

export interface ArtifactTemplate {
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
 * Generate paradoc.json template
 */
export function generateProjectTemplate(
  name: string,
  slug: string,
  options: {
    version?: string
    description?: string
    scaffold?: boolean
    metadata?: Record<string, any>
  } = {}
): ProjectTemplate {
  // Build template with correct field order: name, slug, version, description, artifacts, metadata
  const template: ProjectTemplate = {
    name,
    slug,
    version: options.version || '1.0.0',
    ...(options.description ? { description: options.description } : {}),
    artifacts: options.scaffold
      ? {
          forms: ['forms/**/*.{json,yaml}'],
          documents: ['documents/**/*.{json,yaml}'],
          checklists: ['checklists/**/*.{json,yaml}'],
          bundles: ['bundles/**/*.{json,yaml}'],
        }
      : {
          forms: [],
          documents: [],
          checklists: [],
          bundles: [],
        },
    metadata: options.metadata || {},
  }

  return template
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
    $schema: 'https://schema.paradoc.dev/manifest.json',
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
 * Create a field object from name and type
 */
export function createField(name: string, type: string): Record<string, unknown> {
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


/**
 * Create a resource reference
 */
export function createResourceRef(pathOrSlugOrUri: string): Record<string, string> {
  if (pathOrSlugOrUri.startsWith('http://') || pathOrSlugOrUri.startsWith('https://')) {
    return { uri: pathOrSlugOrUri }
  }
  if (pathOrSlugOrUri.startsWith('@') || pathOrSlugOrUri.includes('/')) {
    return { slug: pathOrSlugOrUri }
  }
  return { path: pathOrSlugOrUri }
}
