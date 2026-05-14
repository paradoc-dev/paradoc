import { Command } from 'commander'
import kleur from 'kleur'
import ora from 'ora'
import prompts from 'prompts'

import type { RegistryEntry, ViewOptions } from '../types.js'
import { configManager } from '../utils/config.js'
import { lockFileManager } from '../utils/lock.js'
import { registryClient, RegistryFetchError } from '../utils/registry-client.js'
import { parseArtifactRef, resolveRegistry } from '../utils/registry.js'
import { findRepoRoot } from '../utils/project.js'
import { trackRegistryAdd } from '../utils/telemetry.js'

type ConfigTarget = 'global' | 'project'

const REGISTRY_NAME_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

/**
 * Convert a string to a valid registry slug
 */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Prompt user to choose between global and project config
 */
async function promptConfigTarget(action: string): Promise<ConfigTarget> {
  const { target } = await prompts({
    type: 'select',
    name: 'target',
    message: `Where would you like to ${action} this registry?`,
    choices: [
      { title: 'Project config (paradoc.json)', value: 'project' },
      { title: 'Global config (~/.paradoc/config.json)', value: 'global' },
    ],
    initial: 0,
  })
  if (target === undefined) throw new Error('User cancelled')
  return target as ConfigTarget
}

/**
 * Create the 'registry' command group
 * Manages registry configurations
 */
export function createRegistryCommand(): Command {
  const registry = new Command('registry')
  registry.description('Manage registry configurations')

  // registry add
  registry
    .command('add')
    .argument('<first>', 'Registry namespace (e.g., @acme) or URL')
    .argument('[second]', 'Registry base URL (required when first arg is a namespace)')
    .option('--header <header>', 'Add HTTP header (format: "Name: Value")', collectHeaders, {})
    .option('--global', 'Save to global config (~/.paradoc/config.json)')
    .option('--project', 'Save to project config (paradoc.json)')
    .option('-y, --yes', 'Skip confirmation prompts (overwrites on conflict)')
    .description('Add or update a registry')
    .action(async (first: string, second: string | undefined, options: { header: Record<string, string>; global?: boolean; project?: boolean; yes?: boolean }) => {
      try {
        let namespace: string
        let url: string

        if (second) {
          // Two args: first = namespace, second = url
          namespace = first.startsWith('@') ? first : `@${first}`
          url = second
        } else {
          // One arg: must be a URL — fetch registry.json to get the name
          let parsedUrl: URL
          try {
            parsedUrl = new URL(first)
          } catch {
            console.error(kleur.red(`When using a single argument, it must be a valid URL.`))
            console.error(kleur.gray('Usage: para registry add <url>'))
            console.error(kleur.gray('   or: para registry add <namespace> <url>'))
            process.exit(1)
          }

          url = parsedUrl.origin + parsedUrl.pathname.replace(/\/$/, '')

          const spinner = ora(`Fetching registry from ${url}...`).start()
          let index
          try {
            const resolved: import('../types.js').ResolvedRegistry = {
              namespace: '',
              baseUrl: url,
              headers: Object.keys(options.header).length > 0 ? options.header : undefined,
            }
            index = await registryClient.fetchIndex(resolved, { skipCache: true })
          } catch (error) {
            spinner.fail('Failed to fetch registry')
            if (error instanceof RegistryFetchError) {
              console.error(kleur.red(`${error.statusCode}: ${error.message}`))
            } else {
              console.error(kleur.red(error instanceof Error ? error.message : String(error)))
            }
            process.exit(1)
          }
          spinner.succeed(`Found registry: ${kleur.bold(index.name)}`)

          const suggested = `@${index.name}`
          if (!options.yes) {
            const { confirmed } = await prompts({
              type: 'text',
              name: 'confirmed',
              message: 'Namespace:',
              initial: suggested,
              validate: (v: string) => {
                const ns = v.startsWith('@') ? v : `@${v}`
                return ns.length >= 2 || 'Namespace is required'
              },
            })
            if (!confirmed) {
              console.log(kleur.yellow('Cancelled.'))
              process.exit(0)
            }
            namespace = confirmed.startsWith('@') ? confirmed : `@${confirmed}`
          } else {
            namespace = suggested
          }
        }

        // Validate URL
        try {
          new URL(url)
        } catch {
          console.error(kleur.red(`Invalid URL: ${url}`))
          process.exit(1)
        }

        // Check if we're in a project
        const projectRoot = await findRepoRoot()
        if (projectRoot) {
          await configManager.loadProjectManifest(projectRoot)
        }

        // Check for namespace conflict
        const existing = await configManager.getRegistry(namespace)
        if (existing) {
          const existingUrl = typeof existing === 'string' ? existing : existing.url
          if (!options.yes) {
            const { action } = await prompts({
              type: 'select',
              name: 'action',
              message: `Namespace ${kleur.bold(namespace)} already exists (${existingUrl}). What would you like to do?`,
              choices: [
                { title: 'Overwrite with new URL', value: 'overwrite' },
                { title: 'Use a different name', value: 'rename' },
                { title: 'Cancel', value: 'cancel' },
              ],
              initial: 0,
            })
            if (action === 'cancel' || action === undefined) {
              console.log(kleur.yellow('Cancelled.'))
              process.exit(0)
            }
            if (action === 'rename') {
              const { newName } = await prompts({
                type: 'text',
                name: 'newName',
                message: 'Enter a new namespace:',
                initial: `${namespace}-2`,
                validate: (v: string) => (v.startsWith('@') ? v : `@${v}`).length >= 2 || 'Namespace is required',
              })
              if (!newName) {
                console.log(kleur.yellow('Cancelled.'))
                process.exit(0)
              }
              namespace = newName.startsWith('@') ? newName : `@${newName}`
            }
            // action === 'overwrite' falls through
          }
          // --yes mode: silently overwrite (matches previous behavior)
        }

        // Build registry entry
        let entry: RegistryEntry
        if (Object.keys(options.header).length > 0) {
          entry = {
            url,
            headers: options.header,
          }
        } else {
          entry = url
        }

        // Determine target config
        let target: ConfigTarget

        if (options.global && options.project) {
          console.error(kleur.red('Cannot specify both --global and --project'))
          process.exit(1)
        }

        if (options.global) {
          target = 'global'
        } else if (options.project) {
          if (!projectRoot) {
            console.error(kleur.red('Not in an Paradoc project. Cannot use --project flag.'))
            console.error(kleur.gray('Use --global to save to global config, or run from a project directory.'))
            process.exit(1)
          }
          target = 'project'
        } else {
          // Interactive prompt
          if (projectRoot) {
            target = await promptConfigTarget('save')
          } else {
            // Not in a project, default to global
            console.log(kleur.gray('Not in a project, saving to global config.'))
            target = 'global'
          }
        }

        // Save to the chosen config
        if (target === 'project') {
          await configManager.setProjectRegistry(namespace, entry)
          console.log(kleur.green('✓') + ` Added registry ${kleur.bold(namespace)} to ${kleur.blue('project config')}`)
        } else {
          await configManager.setGlobalRegistry(namespace, entry)
          console.log(kleur.green('✓') + ` Added registry ${kleur.bold(namespace)} to ${kleur.gray('global config')}`)
        }

        console.log(kleur.gray('URL:'), url)
        if (Object.keys(options.header).length > 0) {
          console.log(kleur.gray('Headers:'), Object.keys(options.header).join(', '))
        }

        // Track registry add for telemetry (fire and forget)
        trackRegistryAdd(url, { hasHeaders: Object.keys(options.header).length > 0 })
      } catch (error) {
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  // registry remove
  registry
    .command('remove')
    .alias('rm')
    .argument('[namespace]', 'Registry namespace to remove (interactive selection if omitted)')
    .option('--global', 'Remove from global config (~/.paradoc/config.json)')
    .option('--project', 'Remove from project config (paradoc.json)')
    .description('Remove a registry')
    .action(async (namespace: string | undefined, options: { global?: boolean; project?: boolean }) => {
      try {
        if (options.global && options.project) {
          console.error(kleur.red('Cannot specify both --global and --project'))
          process.exit(1)
        }

        // Check if we're in a project
        const projectRoot = await findRepoRoot()
        if (projectRoot) {
          await configManager.loadProjectManifest(projectRoot)
        }

        // If namespace provided, use direct removal (original behavior)
        if (namespace) {
          const normalizedNamespace = namespace.startsWith('@') ? namespace : `@${namespace}`

          let target: ConfigTarget

          if (options.global) {
            target = 'global'
          } else if (options.project) {
            if (!projectRoot) {
              console.error(kleur.red('Not in an Paradoc project. Cannot use --project flag.'))
              process.exit(1)
            }
            target = 'project'
          } else {
            if (projectRoot) {
              target = await promptConfigTarget('remove')
            } else {
              target = 'global'
            }
          }

          let removed: boolean
          if (target === 'project') {
            removed = await configManager.removeProjectRegistry(normalizedNamespace)
            if (removed) {
              console.log(kleur.green('✓') + ` Removed registry ${kleur.bold(normalizedNamespace)} from ${kleur.blue('project config')}`)
            } else {
              console.log(kleur.yellow(`Registry not found in project config: ${normalizedNamespace}`))
            }
          } else {
            removed = await configManager.removeGlobalRegistry(normalizedNamespace)
            if (removed) {
              console.log(kleur.green('✓') + ` Removed registry ${kleur.bold(normalizedNamespace)} from ${kleur.dim('global config')}`)
            } else {
              console.log(kleur.yellow(`Registry not found in global config: ${normalizedNamespace}`))
            }
          }
          return
        }

        // Interactive mode: list all registries and let user select
        const registries = await configManager.listRegistries()

        if (registries.length === 0) {
          console.log(kleur.yellow('No registries configured.'))
          return
        }

        const { selected } = await prompts({
          type: 'multiselect',
          name: 'selected',
          message: 'Select registries to remove',
          choices: registries.map((reg) => ({
            title: `${reg.namespace} ${reg.source === 'project' ? kleur.blue('[project]') : kleur.dim('[global]')}`,
            description: reg.url,
            value: reg,
          })),
          instructions: false,
          hint: 'Space to select, Enter to confirm',
        })

        if (!selected || selected.length === 0) {
          console.log(kleur.yellow('No registries selected.'))
          return
        }

        for (const reg of selected as Array<{ namespace: string; url: string; source: 'global' | 'project' }>) {
          let removed: boolean
          if (reg.source === 'project') {
            removed = await configManager.removeProjectRegistry(reg.namespace)
            if (removed) {
              console.log(kleur.green('✓') + ` Removed ${kleur.bold(reg.namespace)} from ${kleur.blue('project config')}`)
            }
          } else {
            removed = await configManager.removeGlobalRegistry(reg.namespace)
            if (removed) {
              console.log(kleur.green('✓') + ` Removed ${kleur.bold(reg.namespace)} from ${kleur.dim('global config')}`)
            }
          }
        }
      } catch (error) {
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  // registry list
  registry
    .command('list')
    .alias('ls')
    .option('--json', 'Output as JSON')
    .description('List configured registries')
    .action(async (options: { json?: boolean }) => {
      try {
        // Load project config if in a project
        const projectRoot = await findRepoRoot()
        if (projectRoot) {
          await configManager.loadProjectManifest(projectRoot)
        }

        const registries = await configManager.listRegistries()

        if (options.json) {
          console.log(JSON.stringify(registries, null, 2))
        } else {
          if (registries.length === 0) {
            console.log(kleur.gray('No registries configured.'))
            console.log(kleur.gray("Run 'para registry add @namespace https://...' to add one."))
            return
          }

          console.log()
          console.log(kleur.bold(`Configured registries (${registries.length}):`))
          console.log()

          for (const reg of registries) {
            const source = reg.source === 'project' ? kleur.blue('[project]') : kleur.gray('[global]')
            console.log(`${kleur.cyan(reg.namespace)} ${source}`)
            console.log(`  ${reg.url}`)
          }
          console.log()
        }
      } catch (error) {
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  // registry make
  registry
    .command('make')
    .argument('[directory]', 'Directory to create registry in', '.')
    .option('-n, --name <name>', 'Registry name')
    .option('--description <description>', 'Registry description')
    .option('--homepage <url>', 'Registry homepage URL')
    .option('--artifacts-path <path>', 'Path prefix for artifacts (e.g., /r or /artifacts)')
    .option('--no-telemetry', 'Disable usage telemetry for this registry')
    .option('--no-directory', 'Do not list this registry in the Paradoc Hub')
    .option('-y, --yes', 'Skip confirmation prompts')
    .description('Create a new registry.json file')
    .action(async (directory: string, options: {
      name?: string
      description?: string
      homepage?: string
      artifactsPath?: string
      telemetry?: boolean
      directory?: boolean
      yes?: boolean
    }) => {
      try {
        const { LocalFileSystem } = await import('../utils/local-fs.js')
        const storage = new LocalFileSystem()
        const targetDir = storage.getAbsolutePath(directory)

        // Check if registry.json already exists
        const registryPath = storage.joinPath(targetDir, 'registry.json')
        if (await storage.exists(registryPath)) {
          if (!options.yes) {
            const { overwrite } = await prompts({
              type: 'confirm',
              name: 'overwrite',
              message: 'registry.json already exists. Overwrite?',
              initial: false,
            })
            if (!overwrite) {
              console.log(kleur.yellow('Cancelled.'))
              process.exit(0)
            }
          } else {
            console.log(kleur.yellow('registry.json already exists, overwriting...'))
          }
        }

        // Get registry name
        let registryName = options.name
        if (!registryName && !options.yes) {
          const initial = slugify(storage.basename(targetDir)) || ''
          const { name } = await prompts({
            type: 'text',
            name: 'name',
            message: 'Registry name (lowercase, a-z, 0-9, hyphens):',
            initial,
            validate: (v: string) => REGISTRY_NAME_PATTERN.test(v) || 'Must be a lowercase slug (a-z, 0-9, hyphens, no leading/trailing hyphens)',
          })
          if (!name) {
            console.log(kleur.yellow('Cancelled.'))
            process.exit(0)
          }
          registryName = name
        }
        if (!registryName) {
          registryName = storage.basename(targetDir)
        }

        // Validate slug pattern (for --name flag or --yes fallback)
        if (!REGISTRY_NAME_PATTERN.test(registryName)) {
          const suggested = slugify(registryName)
          if (!suggested) {
            console.error(kleur.red(`Invalid registry name: "${registryName}". Must be a lowercase slug (a-z, 0-9, hyphens).`))
            process.exit(1)
          }
          if (options.yes) {
            console.log(kleur.yellow(`Auto-corrected registry name: "${registryName}" → "${suggested}"`))
            registryName = suggested
          } else {
            // Interactive mode but came from --name flag
            const { useSuggested } = await prompts({
              type: 'confirm',
              name: 'useSuggested',
              message: `"${registryName}" is not a valid slug. Use "${suggested}" instead?`,
              initial: true,
            })
            if (!useSuggested) {
              const { custom } = await prompts({
                type: 'text',
                name: 'custom',
                message: 'Registry name (lowercase, a-z, 0-9, hyphens):',
                validate: (v: string) => REGISTRY_NAME_PATTERN.test(v) || 'Must be a lowercase slug (a-z, 0-9, hyphens, no leading/trailing hyphens)',
              })
              if (!custom) {
                console.log(kleur.yellow('Cancelled.'))
                process.exit(0)
              }
              registryName = custom
            } else {
              registryName = suggested
            }
          }
        }

        // Get description
        let description = options.description
        if (!description && !options.yes) {
          const { desc } = await prompts({
            type: 'text',
            name: 'desc',
            message: 'Description (optional, press Enter to skip):',
          })
          description = desc || undefined
        }

        // Get homepage
        let homepage = options.homepage
        if (!homepage && !options.yes) {
          const { hp } = await prompts({
            type: 'text',
            name: 'hp',
            message: 'Homepage URL (optional, press Enter to skip):',
            validate: (v: string) => {
              if (!v) return true
              try { new URL(v); return true } catch { return 'Must be a valid URL' }
            },
          })
          homepage = hp || undefined
        }

        // Build registry object
        const registry: Record<string, unknown> = {
          $schema: 'https://schema.paradoc.dev/registry.json',
          name: registryName,
        }

        if (homepage) {
          registry.homepage = homepage
        }

        if (description) {
          registry.description = description
        }

        if (options.artifactsPath) {
          registry.artifactsPath = options.artifactsPath
        }

        // Always include telemetry/directory flags explicitly for transparency
        registry.enableTelemetry = options.telemetry !== false
        registry.enableDirectory = options.directory !== false

        registry.items = []

        // Write the file
        await storage.writeFile(registryPath, JSON.stringify(registry, null, 2))

        console.log(kleur.green('✓') + ` Created ${kleur.cyan('registry.json')}`)
        console.log()
        console.log(kleur.gray('Name:'), registryName)
        if (homepage) {
          console.log(kleur.gray('Homepage:'), homepage)
        }
        if (description) {
          console.log(kleur.gray('Description:'), description)
        }
        if (options.artifactsPath) {
          console.log(kleur.gray('Artifacts path:'), options.artifactsPath)
        }
        console.log()
        console.log(kleur.gray('Next steps:'))
        console.log(kleur.gray('  1. Add artifacts with: para registry catalog add <artifact>'))
        console.log(kleur.gray('  2. Compile registry with: para registry compile'))
      } catch (error) {
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  // registry info
  registry
    .command('info')
    .argument('<namespace>', 'Registry namespace')
    .option('--json', 'Output as JSON')
    .description('Show registry information')
    .action(async (namespace: string, options: { json?: boolean }) => {
      const spinner = ora()

      try {
        const normalizedNamespace = namespace.startsWith('@') ? namespace : `@${namespace}`

        // Load project config if in a project
        const projectRoot = await findRepoRoot()
        if (projectRoot) {
          await configManager.loadProjectManifest(projectRoot)
        }

        // Resolve registry
        spinner.start(`Fetching registry info for ${normalizedNamespace}...`)
        const resolved = await resolveRegistry(normalizedNamespace)

        // Fetch registry index
        let index
        try {
          index = await registryClient.fetchIndex(resolved)
        } catch (error) {
          spinner.fail(`Failed to fetch registry index`)
          if (error instanceof RegistryFetchError) {
            console.error(kleur.red(`${error.statusCode}: ${error.message}`))
          } else {
            console.error(kleur.red(error instanceof Error ? error.message : String(error)))
          }
          process.exit(1)
        }
        spinner.stop()

        if (options.json) {
          console.log(JSON.stringify({
            namespace: normalizedNamespace,
            url: resolved.baseUrl,
            name: index.name,
            description: index.description,
            homepage: index.homepage,
            artifactCount: index.items.length,
          }, null, 2))
        } else {
          console.log()
          console.log(kleur.bold(index.name || normalizedNamespace))
          console.log()

          if (index.description) {
            console.log(index.description)
            console.log()
          }

          console.log(kleur.gray('URL:'), resolved.baseUrl)
          if (index.homepage) {
            console.log(kleur.gray('Homepage:'), index.homepage)
          }
          console.log(kleur.gray('Artifacts:'), index.items.length)
          console.log()

          // Show artifact kinds breakdown
          const kindCounts = new Map<string, number>()
          for (const item of index.items) {
            const count = kindCounts.get(item.kind) || 0
            kindCounts.set(item.kind, count + 1)
          }
          if (kindCounts.size > 0) {
            console.log(kleur.gray('By kind:'))
            for (const [kind, count] of kindCounts) {
              console.log(`  ${kind}: ${count}`)
            }
          }
        }
      } catch (error) {
        spinner.fail('Failed')
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  // registry catalog - subcommand group for managing catalog items
  const catalog = registry.command('catalog')
  catalog.description('Manage registry catalog items')

  // registry catalog add
  catalog
    .command('add')
    .argument('<artifact>', 'Path to artifact file (JSON/YAML)')
    .option('-r, --registry <path>', 'Path to registry.json', './registry.json')
    .option('-y, --yes', 'Skip confirmation prompts')
    .description('Add an artifact to the registry catalog')
    .action(async (artifactPath: string, options: { registry: string; yes?: boolean }) => {
      try {
        const { LocalFileSystem } = await import('../utils/local-fs.js')
        const { parse, validate } = await import('@paradoc/core')
        const storage = new LocalFileSystem()

        // Read registry.json
        const registryPath = storage.getAbsolutePath(options.registry)
        if (!(await storage.exists(registryPath))) {
          console.error(kleur.red(`Registry not found: ${registryPath}`))
          console.error(kleur.gray('Run "para registry make" to create one.'))
          process.exit(1)
        }

        const registryContent = await storage.readFile(registryPath)
        const registryData = JSON.parse(registryContent) as {
          items: Array<{ name: string; kind: string; version: string; path?: string; title?: string; description?: string; layers?: string[]; tags?: string[] }>
          [key: string]: unknown
        }

        // Read and validate artifact
        const fullArtifactPath = storage.getAbsolutePath(artifactPath)
        if (!(await storage.exists(fullArtifactPath))) {
          console.error(kleur.red(`Artifact not found: ${fullArtifactPath}`))
          process.exit(1)
        }

        // Security: artifact must be at same level or below registry.json
        const registryDir = storage.dirname(registryPath)
        const artifactDir = storage.dirname(fullArtifactPath)
        const relative = storage.relative(registryDir, artifactDir)
        if (relative.startsWith('..')) {
          console.error(kleur.red('Security error: Artifact must be at the same level or below registry.json'))
          console.error(kleur.gray(`Registry: ${registryPath}`))
          console.error(kleur.gray(`Artifact: ${fullArtifactPath}`))
          process.exit(1)
        }

        const artifactContent = await storage.readFile(fullArtifactPath)
        const parsed = parse(artifactContent)
        const validation = validate(parsed)

        if (validation.issues) {
          console.error(kleur.red('Artifact validation failed:'))
          for (const issue of validation.issues) {
            const location = issue.path?.length ? issue.path.map(String).join('.') : 'root'
            console.error(`  - ${location}: ${issue.message}`)
          }
          process.exit(1)
        }

        const artifact = validation.value as {
          kind: string
          name: string
          version: string
          title?: string
          description?: string
          layers?: Record<string, unknown>
          tags?: string[]
        }

        // Check if artifact already exists
        const existingIndex = registryData.items.findIndex(
          (item) => item.name === artifact.name
        )

        if (existingIndex >= 0) {
          const existing = registryData.items[existingIndex]
          if (!options.yes) {
            const { update } = await prompts({
              type: 'confirm',
              name: 'update',
              message: `Artifact "${artifact.name}" already exists (v${existing?.version}). Update to v${artifact.version}?`,
              initial: true,
            })
            if (!update) {
              console.log(kleur.yellow('Cancelled.'))
              process.exit(0)
            }
          }
          registryData.items.splice(existingIndex, 1)
        }

        // Build catalog entry
        const entry: { name: string; kind: string; version: string; path?: string; title?: string; description?: string; layers?: string[]; tags?: string[] } = {
          name: artifact.name,
          kind: artifact.kind,
          version: artifact.version,
        }

        // Auto-populate path for artifacts in subfolders
        const relativePath = storage.relative(registryDir, fullArtifactPath)
        if (relativePath.includes('/')) {
          entry.path = relativePath
        }

        if (artifact.title) entry.title = artifact.title
        if (artifact.description) entry.description = artifact.description
        if (artifact.layers) entry.layers = Object.keys(artifact.layers)
        if (artifact.tags) entry.tags = artifact.tags

        registryData.items.push(entry)

        // Sort items by name
        registryData.items.sort((a, b) => a.name.localeCompare(b.name))

        // Write back
        await storage.writeFile(registryPath, JSON.stringify(registryData, null, 2))

        const action = existingIndex >= 0 ? 'Updated' : 'Added'
        console.log(kleur.green('✓') + ` ${action} ${kleur.cyan(artifact.name)} (${artifact.kind} v${artifact.version})`)
        console.log(kleur.gray(`Registry now has ${registryData.items.length} artifact(s)`))
      } catch (error) {
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  // registry catalog remove
  catalog
    .command('remove')
    .alias('rm')
    .argument('<name>', 'Artifact name to remove')
    .option('-r, --registry <path>', 'Path to registry.json', './registry.json')
    .option('-y, --yes', 'Skip confirmation prompts')
    .description('Remove an artifact from the registry catalog')
    .action(async (name: string, options: { registry: string; yes?: boolean }) => {
      try {
        const { LocalFileSystem } = await import('../utils/local-fs.js')
        const storage = new LocalFileSystem()

        // Read registry.json
        const registryPath = storage.getAbsolutePath(options.registry)
        if (!(await storage.exists(registryPath))) {
          console.error(kleur.red(`Registry not found: ${registryPath}`))
          process.exit(1)
        }

        const registryContent = await storage.readFile(registryPath)
        const registryData = JSON.parse(registryContent) as {
          items: Array<{ name: string; kind: string; version: string }>
          [key: string]: unknown
        }

        // Find artifact
        const index = registryData.items.findIndex((item) => item.name === name)
        if (index < 0) {
          console.error(kleur.red(`Artifact not found: ${name}`))
          console.error(kleur.gray('Available artifacts:'))
          for (const item of registryData.items) {
            console.error(kleur.gray(`  - ${item.name}`))
          }
          process.exit(1)
        }

        const item = registryData.items[index]

        if (!options.yes) {
          const { confirm } = await prompts({
            type: 'confirm',
            name: 'confirm',
            message: `Remove "${name}" (${item?.kind} v${item?.version}) from registry?`,
            initial: false,
          })
          if (!confirm) {
            console.log(kleur.yellow('Cancelled.'))
            process.exit(0)
          }
        }

        registryData.items.splice(index, 1)

        // Write back
        await storage.writeFile(registryPath, JSON.stringify(registryData, null, 2))

        console.log(kleur.green('✓') + ` Removed ${kleur.cyan(name)} from registry`)
        console.log(kleur.gray(`Registry now has ${registryData.items.length} artifact(s)`))
      } catch (error) {
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  // registry stats
  registry
    .command('stats')
    .argument('[namespace]', 'Registry namespace (optional, uses local registry.json if not specified)')
    .option('-r, --registry <path>', 'Path to local registry.json', './registry.json')
    .option('--json', 'Output as JSON')
    .description('Show registry statistics (telemetry data)')
    .action(async (namespace: string | undefined, options: { registry: string; json?: boolean }) => {
      try {
        // TODO: Implement telemetry endpoint integration
        // For now, show local registry stats

        const { LocalFileSystem } = await import('../utils/local-fs.js')
        const storage = new LocalFileSystem()

        if (namespace) {
          // Remote registry - would fetch from telemetry endpoint
          console.log(kleur.yellow('Remote telemetry stats not yet implemented.'))
          console.log(kleur.gray('Telemetry endpoint integration coming soon.'))
          process.exit(0)
        }

        // Local registry stats
        const registryPath = storage.getAbsolutePath(options.registry)
        if (!(await storage.exists(registryPath))) {
          console.error(kleur.red(`Registry not found: ${registryPath}`))
          process.exit(1)
        }

        const registryContent = await storage.readFile(registryPath)
        const registryData = JSON.parse(registryContent) as {
          name: string
          items: Array<{ name: string; kind: string; version: string }>
          enableTelemetry?: boolean
          enableDirectory?: boolean
          [key: string]: unknown
        }

        const kindCounts = new Map<string, number>()
        for (const item of registryData.items) {
          const count = kindCounts.get(item.kind) || 0
          kindCounts.set(item.kind, count + 1)
        }

        if (options.json) {
          console.log(JSON.stringify({
            name: registryData.name,
            totalArtifacts: registryData.items.length,
            byKind: Object.fromEntries(kindCounts),
            telemetryEnabled: registryData.enableTelemetry !== false,
            directoryEnabled: registryData.enableDirectory !== false,
          }, null, 2))
        } else {
          console.log()
          console.log(kleur.bold(registryData.name))
          console.log()
          console.log(kleur.gray('Total artifacts:'), registryData.items.length)
          console.log()

          if (kindCounts.size > 0) {
            console.log(kleur.gray('By kind:'))
            for (const [kind, count] of kindCounts) {
              console.log(`  ${kind}: ${count}`)
            }
            console.log()
          }

          console.log(kleur.gray('Telemetry:'), registryData.enableTelemetry !== false ? 'enabled' : 'disabled')
          console.log(kleur.gray('Directory listing:'), registryData.enableDirectory !== false ? 'enabled' : 'disabled')
        }
      } catch (error) {
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  // registry compile
  registry
    .command('compile')
    .option('-r, --registry <path>', 'Path to registry.json', './registry.json')
    .option('-o, --output <path>', 'Output directory for compiled registry items')
    .option('--dry-run', 'Show what would be compiled without writing files')
    .description('Compile registry: validate artifacts, compute checksums, generate registry items')
    .action(async (options: { registry: string; output?: string; dryRun?: boolean }) => {
      const spinner = ora()

      try {
        const { LocalFileSystem } = await import('../utils/local-fs.js')
        const { parse, validate } = await import('@paradoc/core')
        const { computeHash } = await import('../utils/hash.js')
        const storage = new LocalFileSystem()

        // Read registry.json
        const registryPath = storage.getAbsolutePath(options.registry)
        if (!(await storage.exists(registryPath))) {
          console.error(kleur.red(`Registry not found: ${registryPath}`))
          process.exit(1)
        }

        const registryDir = storage.dirname(registryPath)
        const registryContent = await storage.readFile(registryPath)
        const registryData = JSON.parse(registryContent) as {
          name: string
          artifactsPath?: string
          items: Array<{ name: string; kind: string; version: string; path?: string }>
          [key: string]: unknown
        }

        const artifactsPath = registryData.artifactsPath
        const outputDir = options.output
          ? storage.getAbsolutePath(options.output)
          : artifactsPath
            ? storage.joinPath(registryDir, artifactsPath.replace(/^\//, ''))
            : registryDir

        console.log(kleur.bold(`Compiling registry: ${registryData.name}`))
        console.log(kleur.gray(`Output: ${outputDir}`))
        console.log()

        if (!options.dryRun) {
          await storage.mkdir(outputDir)
        }

        let compiled = 0
        let errors = 0

        for (const item of registryData.items) {
          spinner.start(`Compiling ${item.name}...`)

          try {
            // Find the artifact file
            let artifactPath: string | null = null
            if (item.path) {
              // Use explicit path from registry item
              const candidate = storage.joinPath(registryDir, item.path)
              if (await storage.exists(candidate)) {
                artifactPath = candidate
              }
            } else {
              // Default: try {name}.json, .yaml, .yml in registry dir
              for (const ext of ['.json', '.yaml', '.yml']) {
                const candidate = storage.joinPath(registryDir, `${item.name}${ext}`)
                if (await storage.exists(candidate)) {
                  artifactPath = candidate
                  break
                }
              }
            }

            if (!artifactPath) {
              spinner.fail(`${item.name}: artifact file not found`)
              errors++
              continue
            }

            // Read and validate
            const content = await storage.readFile(artifactPath)
            const parsed = parse(content)
            const validation = validate(parsed)

            if (validation.issues) {
              spinner.fail(`${item.name}: validation failed`)
              for (const issue of validation.issues) {
                const location = issue.path?.length ? issue.path.map(String).join('.') : 'root'
                console.error(kleur.red(`    ${location}: ${issue.message}`))
              }
              errors++
              continue
            }

            const artifact = validation.value as Record<string, unknown> & {
              layers?: Record<string, { kind: string; path?: string; [key: string]: unknown }>
            }

            // Process layers - compute checksums for file layers
            if (artifact.layers) {
              for (const [_layerKey, layer] of Object.entries(artifact.layers)) {
                if (layer.kind === 'file' && layer.path) {
                  const layerPath = storage.joinPath(registryDir, layer.path)
                  if (await storage.exists(layerPath)) {
                    const hash = await computeHash(layerPath)
                    layer.checksum = `sha256:${hash}`
                  }
                }
              }
            }

            if (options.dryRun) {
              spinner.succeed(`${item.name}: would compile`)
            } else {
              // Write registry item (use item.path if set, else {name}.json)
              const outputRelPath = item.path || `${item.name}.json`
              const outputPath = storage.joinPath(outputDir, outputRelPath)
              // Ensure parent dirs exist for nested paths
              const outputParent = storage.dirname(outputPath)
              await storage.mkdir(outputParent, true)
              await storage.writeFile(outputPath, JSON.stringify(artifact, null, 2))
              spinner.succeed(`${item.name}: compiled`)
            }
            compiled++
          } catch (err) {
            spinner.fail(`${item.name}: ${err instanceof Error ? err.message : String(err)}`)
            errors++
          }
        }

        console.log()
        if (errors > 0) {
          console.log(kleur.yellow(`Compiled ${compiled}/${registryData.items.length} artifacts (${errors} error(s))`))
        } else {
          console.log(kleur.green(`Compiled ${compiled} artifact(s) successfully`))
        }

        if (options.dryRun) {
          console.log(kleur.gray('(dry run - no files written)'))
        }
      } catch (error) {
        spinner.fail('Compilation failed')
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  // registry view
  registry
    .command('view')
    .argument('<artifact>', 'Artifact reference (@namespace/name)')
    .option('--json', 'Output as JSON')
    .description('View details of an installed artifact')
    .action(async (artifact: string, options: ViewOptions) => {
      try {
        const { LocalFileSystem } = await import('../utils/local-fs.js')
        const YAML = await import('yaml')

        // Parse artifact reference
        const artifactRef = parseArtifactRef(artifact)
        if (!artifactRef) {
          console.error(kleur.red(`Invalid artifact reference: ${artifact}`))
          console.error(kleur.gray('Expected format: @namespace/artifact-name'))
          process.exit(1)
        }

        // Find project root
        const projectRoot = await findRepoRoot()
        if (!projectRoot) {
          console.error(kleur.red('Not in an Paradoc project.'))
          process.exit(1)
        }

        // Load project config and lock file
        await configManager.loadProjectManifest(projectRoot)
        await lockFileManager.init(projectRoot)

        // Check if installed
        if (!lockFileManager.isInstalled(artifactRef.full)) {
          console.error(kleur.red(`Artifact not installed: ${artifact}`))
          console.error(kleur.gray("Run 'para add " + artifact + "' to install it."))
          process.exit(1)
        }

        // Get lock file info
        const lockedInfo = lockFileManager.getArtifact(artifactRef.full)
        if (!lockedInfo) {
          console.error(kleur.red(`Could not read lock info for: ${artifact}`))
          process.exit(1)
        }

        // Read the artifact file
        const storage = new LocalFileSystem(projectRoot)
        const artifactPath = storage.joinPath(lockedInfo.path)
        let artifactContent: Record<string, unknown>
        try {
          const content = await storage.readFile(artifactPath, 'utf-8')
          if (lockedInfo.output === 'json' || lockedInfo.output === 'typed') {
            artifactContent = JSON.parse(content)
          } else {
            artifactContent = YAML.parse(content) as Record<string, unknown>
          }
        } catch {
          console.error(kleur.red(`Could not read artifact file: ${lockedInfo.path}`))
          process.exit(1)
        }

        // Output format
        if (options.json) {
          const output = {
            ref: artifactRef.full,
            installed: lockedInfo,
            artifact: artifactContent,
          }
          console.log(JSON.stringify(output, null, 2))
        } else {
          // Human-readable output
          console.log()
          console.log(kleur.bold(artifact))
          console.log()

          // Basic info
          console.log(kleur.gray('Version:'), lockedInfo.version)
          console.log(kleur.gray('Kind:'), artifactContent.kind || 'unknown')
          if (artifactContent.title) {
            console.log(kleur.gray('Title:'), artifactContent.title)
          }
          if (artifactContent.description) {
            console.log(kleur.gray('Description:'), artifactContent.description)
          }
          console.log()

          // Installation info
          console.log(kleur.gray('Installed:'), new Date(lockedInfo.installedAt).toLocaleString())
          console.log(kleur.gray('Output:'), lockedInfo.output)
          console.log(kleur.gray('Path:'), lockedInfo.path)
          console.log(kleur.gray('Source:'), lockedInfo.resolved)
          console.log()

          // Layers
          const layerEntries = Object.entries(lockedInfo.layers)
          if (layerEntries.length > 0) {
            console.log(kleur.gray('Layers:'))
            for (const [layerKey, layer] of layerEntries) {
              console.log(`  ${kleur.cyan(layerKey)}: ${layer.path}`)
            }
            console.log()
          }

          // Show artifact structure summary
          const artifactLayers = artifactContent.layers as Record<string, unknown> | undefined
          if (artifactLayers) {
            const availableLayerKeys = Object.keys(artifactLayers)
            const installedLayerKeys = Object.keys(lockedInfo.layers)
            const notInstalled = availableLayerKeys.filter((k) => !installedLayerKeys.includes(k))
            if (notInstalled.length > 0) {
              console.log(kleur.gray('Available layers (not installed):'), notInstalled.join(', '))
            }
          }
        }
      } catch (error) {
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  return registry
}

/**
 * Collect --header options into an object
 */
function collectHeaders(value: string, previous: Record<string, string>): Record<string, string> {
  const colonIndex = value.indexOf(':')
  if (colonIndex === -1) {
    throw new Error(`Invalid header format: ${value}. Expected "Name: Value"`)
  }
  const name = value.substring(0, colonIndex).trim()
  const headerValue = value.substring(colonIndex + 1).trim()
  return { ...previous, [name]: headerValue }
}
