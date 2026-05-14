import { Command } from 'commander'
import kleur from 'kleur'
import prompts from 'prompts'
import { parse, validate, toYAML, type Artifact, type Layer } from '@paradoc/core'
import { LocalFileSystem } from '../utils/local-fs.js'

import { readTextInput, resolveArtifactTarget } from '../utils/io.js'
import { computeHash, verifyHashFromFile } from '../utils/hash.js'

interface FixOptions {
  dryRun?: boolean
  yes?: boolean
}

interface PotentialChange {
  field: string
  from: string | number
  to: string | number
  path: string[]
  approved: boolean
}

export function createFixCommand(): Command {
  const fix = new Command('fix')

  fix
    .argument('<artifact>', 'Artifact file (JSON/YAML) to fix')
    .description('Fix artifact metadata (e.g., file checksums in layers)')
    .option('-y, --yes', 'Accept all changes without prompting')
    .option('--dry-run', 'Show what would be changed without modifying the file')
    .action(async (artifactTarget: string, options: FixOptions) => {
      try {
        const resolvedTarget = await resolveArtifactTarget(artifactTarget)
        const { raw, baseDir, sourcePath } = await readTextInput(resolvedTarget)
        const parsed = parse(raw)

        // Validate the artifact first
        const validation = validate(parsed)
        if (validation.issues) {
          const issues = validation.issues.map((issue) => ({
            message: issue.message,
            path: issue.path?.map((segment) => String(segment)),
          }))
          console.error(kleur.red('Validation failed:'))
          for (const issue of issues) {
            const location = issue.path?.length ? issue.path.join('.') : 'root'
            console.error(`  - ${location}: ${issue.message}`)
          }
          process.exit(1)
          return
        }

        const artifact = validation.value as Artifact

        // Check for kind attribute
        if (!artifact || !artifact.kind) {
          throw new Error('Artifact must have a "kind" attribute')
        }

        const storage = new LocalFileSystem(baseDir)
        const potentialChanges: PotentialChange[] = []

        // Detect potential changes in file-backed layers
        if ('layers' in artifact && artifact.layers) {
          const layers = artifact.layers as Record<string, Layer>
          const layerChanges = await detectLayerChanges(layers, storage)
          potentialChanges.push(...layerChanges)
        }

        // Detect potential changes in ContentRef fields (instructions, agentInstructions)
        const contentRefChanges = await detectContentRefChanges(artifact, storage)
        potentialChanges.push(...contentRefChanges)

        if (potentialChanges.length === 0) {
          console.log(kleur.green('✓ No changes needed. All checksums are valid.'))
          process.exit(0)
          return
        }

        // Show summary of changes
        console.log(kleur.cyan('\nChanges detected:'))
        for (const change of potentialChanges) {
          const location = change.path.join('.')
          console.log(
            `  ${location}: ${kleur.red(String(change.from))} → ${kleur.green(String(change.to))}`
          )
        }

        // Interactive confirmation (unless -y flag)
        let approvedChanges: PotentialChange[] = []
        if (options.yes) {
          approvedChanges = potentialChanges.map((c) => ({ ...c, approved: true }))
          console.log(kleur.yellow('\nAccepting all changes (--yes flag)...'))
        } else {
          console.log()
          approvedChanges = await promptForChanges(potentialChanges)
        }

        // Show summary of what will and won't change
        const willChange = approvedChanges.filter((c) => c.approved)
        const wontChange = approvedChanges.filter((c) => !c.approved)

        if (willChange.length > 0) {
          console.log(kleur.green('\nWill change:'))
          for (const change of willChange) {
            const location = change.path.join('.')
            console.log(
              `  ${location}: ${kleur.red(String(change.from))} → ${kleur.green(String(change.to))}`
            )
          }
        }

        if (wontChange.length > 0) {
          console.log(kleur.yellow('\nWill not change:'))
          for (const change of wontChange) {
            const location = change.path.join('.')
            console.log(`  ${location}: ${kleur.gray(String(change.from))} (kept as-is)`)
          }
        }

        if (options.dryRun) {
          console.log(kleur.yellow('\nDry run: No changes written to file.'))
          process.exit(0)
          return
        }

        if (willChange.length === 0) {
          console.log(kleur.yellow('\nNo changes approved. Exiting.'))
          process.exit(0)
          return
        }

        // Apply approved changes
        applyChanges(artifact, willChange)

        // Write the fixed artifact back to the file
        if (!sourcePath) {
          throw new Error('Cannot write fixes: artifact was read from stdin')
        }

        // Determine the format (JSON or YAML) based on file extension
        const outputStorage = new LocalFileSystem()
        const ext = outputStorage.extname(sourcePath).toLowerCase()
        const isJson = ext === '.json'

        const fixedContent = isJson ? JSON.stringify(artifact, null, 2) : toYAML(artifact)
        await outputStorage.writeFile(sourcePath, fixedContent)

        console.log(kleur.green(`\n✓ Fixed artifact written to: ${artifactTarget}`))
        process.exit(0)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(kleur.red(`Error: ${message}`))
        process.exit(1)
      }
    })

  return fix
}

async function detectLayerChanges(
  layers: Record<string, Layer>,
  storage: LocalFileSystem
): Promise<PotentialChange[]> {
  const changes: PotentialChange[] = []

  for (const [layerKey, layer] of Object.entries(layers)) {
    // Only check file-backed layers
    if (layer.kind !== 'file') {
      continue
    }

    const filePath = storage.getAbsolutePath(layer.path)

    // Check if file exists
    try {
      await storage.stat(layer.path)
    } catch {
      console.warn(kleur.yellow(`  Warning: File not found for layer "${layerKey}": ${layer.path}`))
      continue
    }

    // Check checksum
    const actualHashHex = await computeHash(filePath)
    const actualChecksum = `sha256:${actualHashHex}`
    const existingChecksum = layer.checksum

    if (!existingChecksum) {
      // No checksum exists, propose to add it
      changes.push({
        field: 'checksum',
        from: '(none)',
        to: actualChecksum,
        path: ['layers', layerKey, 'checksum'],
        approved: false,
      })
    } else {
      // Checksum exists, verify it matches
      try {
        const matches = await verifyHashFromFile(filePath, existingChecksum)
        if (!matches) {
          changes.push({
            field: 'checksum',
            from: existingChecksum,
            to: actualChecksum,
            path: ['layers', layerKey, 'checksum'],
            approved: false,
          })
        }
      } catch (_error) {
        // Invalid checksum format, propose to fix it
        changes.push({
          field: 'checksum',
          from: existingChecksum,
          to: actualChecksum,
          path: ['layers', layerKey, 'checksum'],
          approved: false,
        })
      }
    }
  }

  return changes
}

async function detectContentRefChanges(
  artifact: Artifact,
  storage: LocalFileSystem
): Promise<PotentialChange[]> {
  const changes: PotentialChange[] = []
  const contentRefFields = ['instructions', 'agentInstructions'] as const
  const artifactRecord = artifact as unknown as Record<string, unknown>

  for (const field of contentRefFields) {
    const ref = artifactRecord[field] as { kind: string; path?: string; checksum?: string } | undefined
    if (!ref || ref.kind !== 'file' || !ref.path) continue

    const filePath = storage.getAbsolutePath(ref.path)

    // Check if file exists
    try {
      await storage.stat(ref.path)
    } catch {
      console.warn(kleur.yellow(`  Warning: File not found for ${field}: ${ref.path}`))
      continue
    }

    // Check checksum
    const actualHashHex = await computeHash(filePath)
    const actualChecksum = `sha256:${actualHashHex}`
    const existingChecksum = ref.checksum

    if (!existingChecksum) {
      changes.push({
        field: 'checksum',
        from: '(none)',
        to: actualChecksum,
        path: [field, 'checksum'],
        approved: false,
      })
    } else {
      try {
        const matches = await verifyHashFromFile(filePath, existingChecksum)
        if (!matches) {
          changes.push({
            field: 'checksum',
            from: existingChecksum,
            to: actualChecksum,
            path: [field, 'checksum'],
            approved: false,
          })
        }
      } catch (_error) {
        changes.push({
          field: 'checksum',
          from: existingChecksum,
          to: actualChecksum,
          path: [field, 'checksum'],
          approved: false,
        })
      }
    }
  }

  return changes
}

async function promptForChanges(changes: PotentialChange[]): Promise<PotentialChange[]> {
  const choices = changes.map((change) => {
    const location = change.path.join('.')
    return {
      title: `${location}: ${kleur.red(String(change.from))} → ${kleur.green(String(change.to))}`,
      value: change.path.join('.'),
      selected: true, // All selected by default
    }
  })

  const { selected } = await prompts({
    type: 'multiselect',
    name: 'selected',
    message: 'Select changes to apply (use spacebar to toggle, arrow keys to navigate):',
    choices,
    hint: '- Space to select. Return to submit',
  })

  // Map back to changes with approval status
  return changes.map((change) => ({
    ...change,
    approved: (selected || []).includes(change.path.join('.')),
  }))
}

function applyChanges(artifact: Artifact, changes: PotentialChange[]): void {
  for (const change of changes) {
    if (!change.approved || change.field !== 'checksum') continue

    if (change.path[0] === 'layers') {
      // Path format: ['layers', layerKey, 'checksum']
      const layerKey = change.path[1]
      if (!layerKey || !('layers' in artifact) || !artifact.layers) continue
      const layers = artifact.layers as Record<string, Layer>
      const layer = layers[layerKey]
      if (layer && layer.kind === 'file') {
        layer.checksum = change.to as string
      }
    } else {
      // Path format: ['instructions', 'checksum'] or ['agentInstructions', 'checksum']
      const field = change.path[0]
      if (!field) continue
      const artifactRecord = artifact as unknown as Record<string, unknown>
      const ref = artifactRecord[field] as { kind: string; checksum?: string } | undefined
      if (ref && ref.kind === 'file') {
        ref.checksum = change.to as string
      }
    }
  }
}
