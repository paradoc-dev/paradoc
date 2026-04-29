import { Command } from 'commander'
import kleur from 'kleur'
import prompts from 'prompts'
import { parse, validate, toYAML, type Artifact, type Layer } from '@paradoc/core'
import { LocalFileSystem } from '../utils/local-fs.js'

import { readTextInput, resolveArtifactTarget } from '../utils/io.js'

interface DetachOptions {
  yes?: boolean
  dryRun?: boolean
}

export function createDetachCommand(): Command {
  const detach = new Command('detach')

  detach
    .argument('<artifact>', 'Artifact file (JSON/YAML) to detach layer from')
    .argument('[target]', 'Layer name, "instructions", or "agent-instructions" (optional, will prompt)')
    .description('Detach (remove) a layer or content reference from an artifact')
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('--dry-run', 'Show what would be changed without modifying the file')
    .action(async (artifactTarget: string, targetArg: string | undefined, options: DetachOptions) => {
      try {
        const storage = new LocalFileSystem()

        // Read and parse the artifact
        const resolvedTarget = await resolveArtifactTarget(artifactTarget)
        const { raw, sourcePath } = await readTextInput(resolvedTarget)
        if (!sourcePath) {
          console.error(kleur.red('Cannot detach from artifact from stdin. Please specify a file path.'))
          process.exit(1)
        }

        const parsed = parse(raw)

        // Validate the artifact
        const validation = validate(parsed)
        if (validation.issues) {
          console.error(kleur.red('Artifact validation failed:'))
          for (const issue of validation.issues) {
            const location = issue.path?.length ? issue.path.map(String).join('.') : 'root'
            console.error(`  - ${location}: ${issue.message}`)
          }
          process.exit(1)
        }

        const artifact = validation.value as Artifact
        const artifactRecord = artifact as unknown as Record<string, unknown>

        // Build list of detachable items: layers + ContentRef fields
        const layers = ('layers' in artifact && artifact.layers)
          ? artifact.layers as Record<string, Layer>
          : {}
        const layerKeys = Object.keys(layers)

        // ContentRef fields present on the artifact
        const contentRefMap: Record<string, string> = {} // display key → field name
        const contentRefFields = [
          { key: 'instructions', display: 'instructions' },
          { key: 'agentInstructions', display: 'agent-instructions' },
        ] as const
        for (const { key, display } of contentRefFields) {
          if (artifactRecord[key]) {
            contentRefMap[display] = key
          }
        }
        const contentRefKeys = Object.keys(contentRefMap)

        const allKeys = [...layerKeys, ...contentRefKeys]

        if (allKeys.length === 0) {
          console.log(kleur.yellow('This artifact has no layers or content references to detach.'))
          process.exit(0)
        }

        // Resolve the argument — accept layer names, "instructions", or "agent-instructions"
        let targetKey = targetArg

        if (!targetKey) {
          if (options.yes) {
            console.error(kleur.red('Target name required in non-interactive mode.'))
            console.error(kleur.gray(`Available: ${allKeys.join(', ')}`))
            process.exit(1)
          }

          // Interactive: let user select from layers + content refs
          console.log()
          console.log(kleur.bold('Detach from Artifact'))
          console.log()

          const choices = [
            ...layerKeys.map((key) => {
              const layer = layers[key]
              const info = layer?.kind === 'file' ? layer.path : '(inline)'
              return {
                title: `${key} ${kleur.gray(`- layer: ${info}`)}`,
                value: key,
              }
            }),
            ...contentRefKeys.map((key) => {
              const fieldName = contentRefMap[key]!
              const ref = artifactRecord[fieldName] as { kind: string; path?: string; text?: string }
              const info = ref.kind === 'file' ? ref.path : '(inline)'
              return {
                title: `${key} ${kleur.gray(`- content ref: ${info}`)}`,
                value: key,
              }
            }),
          ]

          const { selected } = await prompts({
            type: 'select',
            name: 'selected',
            message: 'Select item to detach:',
            choices,
          })

          if (!selected) {
            console.log(kleur.yellow('\nCancelled.'))
            process.exit(0)
          }
          targetKey = selected
        }

        if (!targetKey || !allKeys.includes(targetKey)) {
          console.error(kleur.red(`"${targetKey}" not found.`))
          console.error(kleur.gray(`Available: ${allKeys.join(', ')}`))
          process.exit(1)
        }

        const isContentRef = targetKey in contentRefMap

        // Show what will be removed
        console.log()
        if (isContentRef) {
          const fieldName = contentRefMap[targetKey]!
          const ref = artifactRecord[fieldName] as { kind: string; path?: string; mimeType?: string; text?: string; title?: string }
          console.log(kleur.cyan('Content reference to remove:'))
          console.log(kleur.white(`  ${fieldName}:`))
          console.log(kleur.gray(`    kind: ${ref.kind}`))
          if (ref.kind === 'file' && ref.path) {
            console.log(kleur.gray(`    path: ${ref.path}`))
          }
          if (ref.mimeType) console.log(kleur.gray(`    mimeType: ${ref.mimeType}`))
          if (ref.title) console.log(kleur.gray(`    title: ${ref.title}`))
        } else {
          const layerToRemove = layers[targetKey]
          console.log(kleur.cyan('Layer to remove:'))
          console.log(kleur.white(`  layers.${targetKey}:`))
          if (layerToRemove) {
            console.log(kleur.gray(`    kind: ${layerToRemove.kind}`))
            if (layerToRemove.kind === 'file') {
              console.log(kleur.gray(`    path: ${layerToRemove.path}`))
            }
            console.log(kleur.gray(`    mimeType: ${layerToRemove.mimeType}`))
            if (layerToRemove.title) console.log(kleur.gray(`    title: ${layerToRemove.title}`))
          }
        }
        console.log()

        // Confirm removal
        if (!options.yes) {
          const label = isContentRef ? `content reference "${targetKey}"` : `layer "${targetKey}"`
          const { confirm } = await prompts({
            type: 'confirm',
            name: 'confirm',
            message: `Remove ${label}?`,
            initial: false,
          })

          if (!confirm) {
            console.log(kleur.yellow('Cancelled.'))
            process.exit(0)
          }
        }

        if (options.dryRun) {
          console.log(kleur.yellow('Dry run: No changes written to file.'))
          process.exit(0)
        }

        // Apply removal
        if (isContentRef) {
          const fieldName = contentRefMap[targetKey]!
          delete artifactRecord[fieldName]
        } else {
          delete layers[targetKey!]
          if (Object.keys(layers).length === 0) {
            delete artifactRecord.layers
          }
        }

        // Write back to file
        const outputExt = storage.extname(sourcePath).toLowerCase()
        const isJson = outputExt === '.json'
        const content = isJson ? JSON.stringify(artifact, null, 2) : toYAML(artifact)
        await storage.writeFile(sourcePath, content)

        const kindLabel = isContentRef ? 'content reference' : 'layer'
        console.log(kleur.green(`Detached ${kindLabel} "${targetKey}" from: ${artifactTarget}`))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(kleur.red(`Error: ${message}`))
        process.exit(1)
      }
    })

  return detach
}
