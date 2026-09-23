import { readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Command } from 'commander'
import kleur from 'kleur'
import * as Diff from 'diff'
import fg from 'fast-glob'
import { parse as parseYaml } from 'yaml'
import {
  SCHEMA_VERSION,
  SCHEMA_VERSIONS,
  SchemaMigrationError,
  isSchemaVersion,
  migrateArtifactSource,
  type ArtifactSourceFormat,
  type SchemaVersion,
} from '@paradoc/core'

interface MigrateCommandOptions {
  dryRun?: boolean
  from?: string
}

type FileOutcome =
  | { file: string; status: 'migrated'; from: SchemaVersion; to: SchemaVersion; before: string; after: string }
  | { file: string; status: 'current' }
  | { file: string; status: 'failed'; reason: string }
  | { file: string; status: 'skipped' }

const ARTIFACT_KINDS = new Set(['form', 'document', 'checklist', 'bundle'])

function formatOf(file: string): ArtifactSourceFormat | null {
  const extension = path.extname(file).toLowerCase()
  if (extension === '.json') return 'json'
  if (extension === '.yaml' || extension === '.yml') return 'yaml'
  return null
}

/** Artifact files under a directory, skipping dependencies and build output. */
async function artifactFilesIn(directory: string): Promise<string[]> {
  const files = await fg('**/*.{json,yaml,yml}', {
    cwd: directory,
    absolute: true,
    dot: false,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
  })
  return files.sort()
}

/**
 * Whether content found while walking a directory should be migrated.
 * Other JSON and YAML files (package manifests, configuration) are skipped;
 * content that does not parse is kept so the migration reports it.
 */
function isArtifactContent(content: string, format: ArtifactSourceFormat): boolean {
  let value: unknown
  try {
    value = format === 'json' ? JSON.parse(content) : parseYaml(content)
  } catch {
    return true
  }
  return typeof value === 'object' && value !== null && ARTIFACT_KINDS.has(String((value as { kind?: unknown }).kind))
}

async function migrateFile(
  file: string,
  options: { from?: SchemaVersion; dryRun: boolean; walking: boolean },
): Promise<FileOutcome> {
  const format = formatOf(file)
  if (!format) return { file, status: 'failed', reason: 'Not a JSON or YAML file.' }
  const before = await readFile(file, 'utf-8')
  if (options.walking && !isArtifactContent(before, format)) return { file, status: 'skipped' }
  try {
    const result = migrateArtifactSource(before, { format, from: options.from })
    if (result.status === 'current') return { file, status: 'current' }
    if (!options.dryRun) await writeFile(file, result.content, 'utf-8')
    return { file, status: 'migrated', from: result.from, to: result.to, before, after: result.content }
  } catch (error) {
    if (error instanceof SchemaMigrationError) return { file, status: 'failed', reason: error.message }
    throw error
  }
}

function printDiff(file: string, before: string, after: string): void {
  const patch = Diff.createPatch(file, before, after, '', '', { context: 3 })
  for (const line of patch.split('\n').slice(2)) {
    if (line.startsWith('+++') || line.startsWith('---')) console.log(kleur.gray(line))
    else if (line.startsWith('@@')) console.log(kleur.cyan(line))
    else if (line.startsWith('+')) console.log(kleur.green(line))
    else if (line.startsWith('-')) console.log(kleur.red(line))
    else console.log(line)
  }
}

function report(outcome: FileOutcome, dryRun: boolean): void {
  const file = path.relative(process.cwd(), outcome.file) || outcome.file
  switch (outcome.status) {
    case 'migrated':
      if (dryRun) printDiff(file, outcome.before, outcome.after)
      console.log(`${kleur.green(dryRun ? 'would migrate' : 'migrated')}  ${file}  ${kleur.gray(`${outcome.from} → ${outcome.to}`)}`)
      break
    case 'current':
      console.log(`${kleur.gray('current')}   ${file}`)
      break
    case 'failed':
      console.log(`${kleur.red('failed')}    ${file}: ${outcome.reason}`)
      break
    case 'skipped':
      break
  }
}

/**
 * Create the 'migrate' command.
 * Rewrites artifact files to the current schema version.
 */
export function createMigrateCommand(): Command {
  const migrate = new Command('migrate')

  migrate
    .argument('<path>', 'Artifact file, or a directory of artifact files')
    .description(`Migrate artifact files to the current schema version (${SCHEMA_VERSION})`)
    .option('--dry-run', 'Print the diff for each file and change nothing')
    .option('--from <version>', 'Schema version of files that declare none (no $schema)')
    .action(async (target: string, options: MigrateCommandOptions) => {
      try {
        if (options.from !== undefined && !isSchemaVersion(options.from)) {
          throw new Error(`Unknown schema version: ${options.from}. Known versions: ${SCHEMA_VERSIONS.join(', ')}.`)
        }
        const from = options.from as SchemaVersion | undefined
        const dryRun = options.dryRun === true

        const resolved = path.resolve(target)
        const info = await stat(resolved).catch(() => null)
        if (!info) throw new Error(`Path not found: ${target}`)
        const walking = info.isDirectory()
        const files = walking ? await artifactFilesIn(resolved) : [resolved]

        const outcomes: FileOutcome[] = []
        for (const file of files) {
          const outcome = await migrateFile(file, { from, dryRun, walking })
          report(outcome, dryRun)
          outcomes.push(outcome)
        }

        const count = (status: FileOutcome['status']) => outcomes.filter((outcome) => outcome.status === status).length
        const migrated = count('migrated')
        const failed = count('failed')
        console.log('')
        console.log(
          `${migrated} ${dryRun ? 'to migrate' : 'migrated'}, ${count('current')} current, ${failed} failed` +
            kleur.gray(`  (schema version ${SCHEMA_VERSION})`),
        )
        if (dryRun) console.log(kleur.gray('Dry run: no files were written.'))
        if (failed > 0) process.exit(1)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(kleur.red(`Error: ${message}`))
        process.exit(1)
      }
    })

  return migrate
}
