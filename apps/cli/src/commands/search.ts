import { Command } from 'commander'
import kleur from 'kleur'
import ora from 'ora'

import type { SearchOptions, ArtifactKind } from '../types.js'
import { resolveRegistry } from '../utils/registry.js'
import { registryClient } from '../utils/registry-client.js'
import { configManager } from '../utils/config.js'
import { findRepoRoot } from '../utils/project.js'

/**
 * Create the 'search' command
 * Searches for artifacts in a registry
 */
export function createSearchCommand(): Command {
  const search = new Command('search')

  search
    .argument('[query]', 'Search query (name, title, or description)')
    .description('Search for artifacts in a registry')
    .option('--registry <namespace>', 'Registry namespace to search (default: @paradoc)')
    .option('--kind <kind>', 'Filter by artifact kind (form, document, checklist, bundle)')
    .option('--tags <tags>', 'Filter by tags (comma-separated)')
    .option('--json', 'Output as JSON')
    .action(async (query: string | undefined, options: SearchOptions & { registry?: string }) => {
      const spinner = ora()

      try {
        // Find project root (optional for search)
        const projectRoot = await findRepoRoot()
        if (projectRoot) {
          await configManager.loadProjectManifest(projectRoot)
        }

        // Determine registry namespace
        const namespace = options.registry
          ? (options.registry.startsWith('@') ? options.registry : `@${options.registry}`)
          : '@paradoc'

        // Verify the namespace exists in config
        const registryEntry = await configManager.getRegistry(namespace)
        if (!registryEntry) {
          const registries = await configManager.listRegistries()
          console.error(kleur.red(`Registry not found: ${namespace}`))
          if (registries.length > 0) {
            console.log()
            console.log('Configured registries:')
            for (const reg of registries) {
              const source = reg.source === 'project' ? kleur.blue('[project]') : kleur.dim('[global]')
              console.log(`  ${kleur.cyan(reg.namespace)} ${source}`)
            }
          }
          console.log()
          console.log(`To add a registry: ${kleur.white('para registry add <url>')}`)
          process.exit(1)
        }

        // Validate kind if provided
        if (options.kind) {
          const validKinds: ArtifactKind[] = ['form', 'document', 'checklist', 'bundle']
          if (!validKinds.includes(options.kind)) {
            console.error(kleur.red(`Invalid kind: ${options.kind}`))
            console.error(kleur.gray(`Valid kinds: ${validKinds.join(', ')}`))
            process.exit(1)
          }
        }

        // Parse tags
        const tags = options.tags?.split(',').map((t) => t.trim()).filter(Boolean)

        // Resolve registry
        spinner.start(`Searching ${namespace}...`)
        const registry = await resolveRegistry(namespace)

        // Search artifacts
        const results = await registryClient.searchArtifacts(registry, {
          query,
          kind: options.kind,
          tags,
        })
        spinner.stop()

        // Output
        if (options.json) {
          console.log(JSON.stringify(results, null, 2))
        } else {
          if (results.length === 0) {
            console.log(kleur.gray('No artifacts found.'))
            if (query) {
              console.log(kleur.gray(`Try a different search query or remove filters.`))
            }
            return
          }

          console.log()
          console.log(kleur.bold(`Found ${results.length} artifact${results.length === 1 ? '' : 's'}:`))
          console.log()

          for (const item of results) {
            // Artifact reference
            const ref = `${namespace}/${item.name}`
            console.log(`${kleur.cyan(ref)} ${kleur.dim('v' + item.version)}`)

            // Title and description
            if (item.title) {
              console.log(`  ${item.title}`)
            }
            if (item.description) {
              const desc = item.description.length > 80
                ? item.description.substring(0, 77) + '...'
                : item.description
              console.log(`  ${desc}`)
            }

            // Kind and tags
            const meta: string[] = []
            meta.push(kleur.yellow(item.kind))
            if (item.tags && item.tags.length > 0) {
              meta.push(item.tags.map((t) => kleur.blue(`#${t}`)).join(' '))
            }
            if (item.layers && item.layers.length > 0) {
              meta.push(`${item.layers.length} layers`)
            }
            console.log(`  ${meta.join(kleur.dim(' · '))}`)
            console.log()
          }

          // Hint
          console.log(`Run ${kleur.white(`para add ${namespace}/<name>`)} to install an artifact.`)
        }
      } catch (error) {
        spinner.fail('Search failed')
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  return search
}
