import { Command } from 'commander'
import kleur from 'kleur'
import prompts from 'prompts'
import semver from 'semver'
import { resolve } from 'node:path'
import { validate } from '@paradoc/core'
import { FORM_FIELD_TYPES } from '@paradoc/schemas'
import { LocalFileSystem } from '../../utils/local-fs.js'
import { generateFilename, generateSlug } from '../../utils/slugify.js'
import {
  createChecklistItem,
  createField,
  generateBundleTemplate,
  generateChecklistTemplate,
  generateDocumentTemplate,
  generateFormTemplate,
  isValidFieldType,
  parseFieldDefinition,
  type ArtifactTemplate,
} from '../../utils/templates.js'
import { showArtifactDetails, writeFile } from '../../utils/file-writer.js'
import { collect } from '../../utils/cli-helpers.js'

export type ArtifactKind = 'form' | 'document' | 'checklist' | 'bundle'
export interface ArtifactOptions {
  yes?: boolean
  force?: boolean
  slug?: string
  title?: string
  description?: string
  code?: string
  artifactVersion?: string
  dir?: string
  field?: string[]
  item?: string[]
  dryRun?: boolean
  format?: string
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const FIELD_ID = /^[A-Za-z_][A-Za-z0-9_]*$/

function cancel(): never {
  console.log('\n' + kleur.yellow('Cancelled.') + '\n')
  process.exit(0)
}

function onCancel(): boolean {
  cancel()
}

function assertInputs(slug: string, version: string, format: string, fields: readonly string[]): asserts format is 'json' | 'yaml' {
  if (!SLUG.test(slug)) throw new Error(`Invalid slug "${slug}". Use lowercase letters, numbers, and single hyphens.`)
  if (!semver.valid(version)) throw new Error(`Invalid artifact version "${version}". Use a valid SemVer version.`)
  if (format !== 'json' && format !== 'yaml') throw new Error(`Invalid format "${format}". Use "json" or "yaml".`)
  for (const definition of fields) {
    if (definition.split(':').length > 2) throw new Error(`Invalid field definition "${definition}". Use name:type.`)
    const { name, type } = parseFieldDefinition(definition)
    if (!FIELD_ID.test(name)) throw new Error(`Invalid field id "${name}". Use letters, numbers, and underscores, starting with a letter or underscore.`)
    if (!isValidFieldType(type)) {
      throw new Error(`Unknown field type "${type}" for field "${name}". Valid types: ${[...FORM_FIELD_TYPES].sort().join(', ')}`)
    }
  }
}

function template(kind: ArtifactKind, slug: string, title: string, options: ArtifactOptions, version: string): ArtifactTemplate {
  const common = { description: options.description, code: options.code, version }
  if (kind === 'form') {
    const fields = Object.fromEntries((options.field ?? []).map((definition) => {
      const { name, type } = parseFieldDefinition(definition)
      return [name, createField(name, type as Parameters<typeof createField>[1])]
    }))
    return generateFormTemplate(slug, title, { ...common, fields })
  }
  if (kind === 'checklist') {
    return generateChecklistTemplate(slug, title, {
      ...common,
      items: (options.item ?? []).map(createChecklistItem),
    })
  }
  if (kind === 'document') return generateDocumentTemplate(slug, title, common)
  return generateBundleTemplate(slug, title, common)
}

async function create(kind: ArtifactKind, name: string, supplied: ArtifactOptions): Promise<void> {
  const defaults = {
    title: supplied.title ?? name.split(/[-_]/).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
    slug: supplied.slug ?? generateSlug(name),
    version: supplied.artifactVersion ?? '1.0.0',
    format: supplied.format ?? 'json',
    dir: supplied.dir ?? '.',
  }
  let options = { ...supplied }
  let values = defaults

  if (!supplied.yes) {
    console.log(`\n${kleur.bold(`Create ${kind.charAt(0).toUpperCase() + kind.slice(1)}`)}\n`)
    const answers = await prompts([
      { type: 'text', name: 'title', message: 'Title:', initial: defaults.title, validate: (v: string) => v.trim() ? true : 'Title is required' },
      { type: 'text', name: 'slug', message: 'Slug:', initial: defaults.slug, validate: (v: string) => SLUG.test(v.trim()) ? true : 'Use lowercase letters, numbers, and single hyphens' },
      { type: 'text', name: 'description', message: 'Description (optional):', initial: supplied.description ?? '' },
      { type: 'text', name: 'code', message: 'Code/reference (optional):', initial: supplied.code ?? '' },
      { type: 'text', name: 'version', message: 'Version:', initial: defaults.version, validate: (v: string) => semver.valid(v.trim()) ? true : 'Use a valid SemVer version' },
      { type: 'select', name: 'format', message: 'Format:', choices: [{ title: 'json', value: 'json' }, { title: 'yaml', value: 'yaml' }], initial: defaults.format === 'yaml' ? 1 : 0 },
      { type: 'text', name: 'dir', message: `Where would you like to save this ${kind}?`, initial: defaults.dir, validate: (v: string) => v.trim() ? true : 'Directory is required' },
    ], { onCancel })
    values = { title: answers.title.trim(), slug: answers.slug.trim(), version: answers.version.trim(), format: answers.format, dir: answers.dir.trim() }
    options = { ...options, description: answers.description?.trim() || undefined, code: answers.code?.trim() || undefined }
  }

  assertInputs(values.slug, values.version, values.format, options.field ?? [])
  const artifact = template(kind, values.slug, values.title, options, values.version)
  const result = validate(artifact)
  if (result.issues) {
    throw new Error(`Refusing to write an invalid ${kind}: ${result.issues.map((issue) => `${issue.path?.join('.') || 'root'}: ${issue.message}`).join('; ')}`)
  }

  const filePath = resolve(values.dir, generateFilename(values.slug, values.format))
  const storage = new LocalFileSystem()
  if (!options.dryRun && await storage.exists(filePath) && !options.force) {
    if (options.yes) throw new Error(`File already exists: ${filePath}. Pass --force to overwrite it.`)
    const { overwrite } = await prompts({ type: 'confirm', name: 'overwrite', message: `${filePath} exists. Overwrite it?`, initial: false }, { onCancel })
    if (!overwrite) cancel()
  }

  await writeFile(filePath, artifact, { dryRun: options.dryRun, format: values.format })
  if (!options.dryRun) showArtifactDetails(artifact)
}

export function createArtifactCommand(kind: ArtifactKind): Command {
  const command = new Command(kind)
    .argument('<name>', `Name of the ${kind}`)
    .description(`Create a new ${kind}`)
    .option('-y, --yes', 'Non-interactive mode (skip prompts)')
    .option('--force', 'Overwrite an existing artifact file')
    .option('--slug <slug>', 'Override auto-generated slug')
    .option('--title <title>', 'Human-readable title')
    .option('--description <desc>', 'Description')
    .option('--code <code>', 'Code/reference')
    .option('--artifact-version <version>', 'Version (default: 1.0.0)')
    .option('--dir <path>', 'Custom output directory')
    .option('--dry-run', 'Preview without creating files')
    .option('--format <format>', 'Output format (json|yaml)', 'json')
  if (kind === 'form') command.option('--field <name:type>', 'Add field (repeatable)', collect, [])
  if (kind === 'checklist') command.option('--item <text>', 'Add item (repeatable)', collect, [])
  return command.action(async (name: string, options: ArtifactOptions) => {
    try { await create(kind, name, options) }
    catch (error) {
      console.error(kleur.red(error instanceof Error ? error.message : String(error)))
      process.exit(1)
    }
  })
}
