import { Command } from 'commander'
import kleur from 'kleur'
import prompts from 'prompts'
import { toYAML, type Artifact } from '@paradoc/core'
import { LocalFileSystem } from '../utils/local-fs.js'

import { readTextInput, resolveArtifactTarget } from '../utils/io.js'
import { computeHash, verifyHashFromFile } from '../utils/hash.js'
import { artifactSourceFormatOf, fileReferencesOf, loadValidatedArtifact } from '../utils/artifact-file.js'

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
        const artifact = loadValidatedArtifact(raw)

        // Check for kind attribute
        if (!artifact || !artifact.kind) {
          throw new Error('Artifact must have a "kind" attribute')
        }

        const storage = new LocalFileSystem(baseDir)
        const potentialChanges: PotentialChange[] = []

        potentialChanges.push(...await detectFileChanges(artifact, storage))

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

        if (options.dryRun) {
          console.log(kleur.yellow('\nDry run: No changes written to file.'))
          process.exit(0)
          return
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
        const fixedContent = artifactSourceFormatOf(sourcePath) === 'json' ? JSON.stringify(artifact, null, 2) : toYAML(artifact)
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

async function detectFileChanges(artifact: Artifact, storage: LocalFileSystem): Promise<PotentialChange[]> {
  const changes: PotentialChange[] = []

  for (const reference of fileReferencesOf(artifact)) {
    if (reference.checksum === undefined && reference.propertyPath[0] === 'contents') continue
    const filePath = storage.getAbsolutePath(reference.path)

    // Check if file exists
    try {
      await storage.stat(reference.path)
    } catch {
      console.warn(kleur.yellow(`  Warning: File not found: ${reference.path}`))
      continue
    }

    // Check checksum
    const actualHashHex = await computeHash(filePath)
    const actualChecksum = `sha256:${actualHashHex}`
    const existingChecksum = reference.checksum

    if (!existingChecksum) {
      // No checksum exists, propose to add it
      changes.push({
        field: 'checksum',
        from: '(none)',
        to: actualChecksum,
        path: [...reference.propertyPath, 'checksum'],
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
            path: [...reference.propertyPath, 'checksum'],
            approved: false,
          })
        }
      } catch {
        changes.push({
          field: 'checksum',
          from: existingChecksum,
          to: actualChecksum,
          path: [...reference.propertyPath, 'checksum'],
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

    let target: unknown = artifact
    for (const segment of change.path.slice(0, -1)) {
      if (!target || typeof target !== 'object') break
      target = (target as Record<string, unknown>)[segment]
    }
    if (target && typeof target === 'object') {
      (target as Record<string, unknown>).checksum = change.to
    }
  }
}
