import { Command } from 'commander'
import kleur from 'kleur'
import ora from 'ora'

import type { SearchOptions, ArtifactKind } from '../types.js'
import { resolveRegistry } from '../utils/registry.js'
import { registryClient, RequestTimeoutError } from '../utils/registry-client.js'
import { configManager, normalizeNamespace } from '../utils/config.js'
import { findRepoRoot } from '../utils/project.js'
import { formatLayerCount } from '../utils/user-copy.js'

/** fetch() rejects with a TypeError carrying a cause when no response arrives at all. */
function isUnreachable(error: unknown): error is TypeError | RequestTimeoutError {
  return error instanceof RequestTimeoutError || (error instanceof TypeError && error.cause !== undefined)
}

function describeUnreachable(error: TypeError | RequestTimeoutError): string {
  return error.cause instanceof Error ? `${error.message} (${error.cause.message})` : error.message
}

/**
 * The namespace to search: `--registry`, else the one configured registry.
 * There is no default registry, so none or several configured is an error.
 */
async function searchNamespace(registry: string | undefined): Promise<string> {
  if (registry) return normalizeNamespace(registry)
  const configured = await configManager.listRegistries()
  if (configured.length === 1) return configured[0]!.namespace
  if (configured.length === 0) {
    throw new Error(
      'No registry to search. Pass --registry @<namespace>, or add one first: paradoc registry add @<namespace> <url>',
    )
  }
  throw new Error(
    `Several registries are configured (${configured.map((r) => r.namespace).join(', ')}). Pass --registry to choose one.`,
  )
}

/**
 * Create the 'search' command
 * Searches for artifacts in a registry
 */
export function createSearchCommand(): Command {
  const search = new Command('search')

  search
    .argument('[query]', 'Search query (name, title, or description)')
    .description('Search for artifacts in a registry')
    .option('--registry <namespace>', 'Registry namespace to search (default: the only configured registry)')
    .option('--kind <kind>', 'Filter by artifact kind (form, document, checklist, bundle)')
    .option('--tags <tags>', 'Filter by tags (comma-separated)')
    .option('--json', 'Output as JSON')
    .option('--no-cache', 'Skip cache and fetch fresh')
    .action(async (query: string | undefined, options: SearchOptions & { registry?: string; cache?: boolean }) => {
      const spinner = ora()

      try {
        // Find project root (optional for search)
        const projectRoot = await findRepoRoot()
        if (projectRoot) {
          await configManager.loadProjectManifest(projectRoot)
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

        const namespace = await searchNamespace(options.registry)

        // Parse tags
        const tags = options.tags?.split(',').map((t) => t.trim()).filter(Boolean)

        // Resolve registry (an unconfigured namespace fails here, naming the add command)
        const registry = await resolveRegistry(namespace)
        const cache = await configManager.getEffectiveCacheSettings(namespace)
        await registryClient.initCache({ directory: cache.directory })
        spinner.start(`Searching ${namespace}...`)

        // Search artifacts
        let results
        try {
          results = await registryClient.searchArtifacts(registry, {
            query,
            kind: options.kind,
            tags,
          }, {
            cacheTtl: options.cache === false ? 0 : cache.ttl,
            skipCache: options.cache === false,
          })
        } catch (error) {
          if (isUnreachable(error)) {
            throw new Error(`Cannot reach registry ${namespace} at ${registry.baseUrl}: ${describeUnreachable(error)}`)
          }
          throw error
        }
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
              meta.push(formatLayerCount(item.layers.length))
            }
            console.log(`  ${meta.join(kleur.dim(' · '))}`)
            console.log()
          }

          // Hint
          console.log(`Run ${kleur.white(`paradoc add ${namespace}/<name>`)} to install an artifact.`)
        }
      } catch (error) {
        spinner.fail('Search failed')
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  return search
}
