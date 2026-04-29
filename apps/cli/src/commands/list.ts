import { Command } from 'commander'
import kleur from 'kleur'

import type { ListOptions, ArtifactKind } from '../types.js'
import { lockFileManager } from '../utils/lock.js'
import { configManager } from '../utils/config.js'
import { findRepoRoot } from '../utils/project.js'

/**
 * Create the 'list' command
 * Lists installed artifacts in the project
 */
export function createListCommand(): Command {
  const list = new Command('list')

  list
    .alias('ls')
    .description('List installed artifacts')
    .option('--json', 'Output as JSON')
    .option('--kind <kind>', 'Filter by artifact kind (form, document, checklist, bundle)')
    .action(async (options: ListOptions) => {
      try {
        // Find project root
        const projectRoot = await findRepoRoot()
        if (!projectRoot) {
          console.error(kleur.red('Not in an Paradoc project.'))
          process.exit(1)
        }

        // Load project config and lock file
        await configManager.loadProjectManifest(projectRoot)
        await lockFileManager.init(projectRoot)

        // Get all installed artifacts
        let artifacts = lockFileManager.listArtifacts()

        // Filter by kind if specified
        if (options.kind) {
          const validKinds: ArtifactKind[] = ['form', 'document', 'checklist', 'bundle']
          if (!validKinds.includes(options.kind)) {
            console.error(kleur.red(`Invalid kind: ${options.kind}`))
            console.error(kleur.gray(`Valid kinds: ${validKinds.join(', ')}`))
            process.exit(1)
          }

          artifacts = artifacts.filter(({ info }) => info.kind === options.kind)
        }

        // Output
        if (options.json) {
          const output = artifacts.map(({ ref, info }) => ({
            ref,
            version: info.version,
            output: info.output,
            path: info.path,
            installedAt: info.installedAt,
            layers: Object.keys(info.layers),
          }))
          console.log(JSON.stringify(output, null, 2))
        } else {
          if (artifacts.length === 0) {
            console.log(kleur.gray('No artifacts installed.'))
            console.log(kleur.gray("Run 'para add @namespace/artifact-name' to install one."))
            return
          }

          console.log()
          console.log(kleur.bold(`Installed artifacts (${artifacts.length}):`))
          console.log()

          // Group by namespace
          const byNamespace = new Map<string, typeof artifacts>()
          for (const artifact of artifacts) {
            const parts = artifact.ref.split('/')
            const namespace = parts[0] ?? 'unknown'
            if (!byNamespace.has(namespace)) {
              byNamespace.set(namespace, [])
            }
            byNamespace.get(namespace)?.push(artifact)
          }

          for (const [namespace, nsArtifacts] of byNamespace) {
            console.log(kleur.cyan(namespace))
            for (const { ref, info } of nsArtifacts) {
              const name = ref.split('/')[1] ?? ref
              const layerCount = Object.keys(info.layers).length
              const layerInfo = layerCount > 0 ? kleur.gray(` (${layerCount} layers)`) : ''
              console.log(`  ${name} ${kleur.gray('v' + info.version)}${layerInfo}`)
            }
          }
          console.log()
        }
      } catch (error) {
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  return list
}
