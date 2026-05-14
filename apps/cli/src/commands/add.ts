import { Command } from 'commander'
import kleur from 'kleur'
import YAML from 'yaml'
import ora, { type Ora } from 'ora'
import prompts from 'prompts'
import { jsonToDts, jsonToTsModule } from '@paradoc/core'
import { LocalFileSystem } from '../utils/local-fs.js'

import type { AddOptions, OutputFormat, ArtifactKind, ResolvedRegistry, RegistryItemSummary } from '../types.js'
import { parseArtifactArg, resolveRegistry, createRegistryFromUrl, buildArtifactItemUrl, parseNamespaceOnly } from '../utils/registry.js'
import { registryClient, RegistryFetchError, type RegistryItem } from '../utils/registry-client.js'
import { lockFileManager } from '../utils/lock.js'
import { configManager } from '../utils/config.js'
import { findRepoRoot } from '../utils/project.js'
import { sanitizePath, validateDownloadedArtifact, assertNotSymlink, SymlinkError } from '../utils/security.js'
import { verifyChecksum } from '../utils/hash.js'
import { trackInstall } from '../utils/telemetry.js'
import { join } from 'node:path'

interface InstallArtifactOpts {
  registry: ResolvedRegistry
  artifactName: string
  artifactNamespace: string
  artifactFull: string
  resolvedUrl?: string
  projectRoot: string
  options: AddOptions & { header?: string[]; cache?: boolean }
  spinner: Ora
}

/**
 * Install a single artifact from a registry into the project
 */
async function installArtifact(opts: InstallArtifactOpts): Promise<void> {
  const { registry, artifactName, artifactNamespace, artifactFull, projectRoot, options, spinner } = opts
  let { resolvedUrl } = opts

  // Determine cache options
  const skipCache = options.cache === false
  const cacheTtl = skipCache ? 0 : await configManager.getEffectiveCacheTtl(
    artifactNamespace,
    options.cacheTtl
  )

  // Fetch artifact from registry
  spinner.start(`Fetching ${artifactFull}...`)

  let registryItem
  try {
    registryItem = await registryClient.fetchItem(registry, artifactName, {
      cacheTtl,
      skipCache,
    })
  } catch (error) {
    spinner.fail(`Failed to fetch ${artifactFull}`)
    if (error instanceof RegistryFetchError && error.statusCode === 404) {
      console.error(kleur.red(`Artifact not found: ${artifactFull}`))
      console.error(kleur.gray(`Registry: ${registry.baseUrl}`))
    } else {
      console.error(kleur.red(error instanceof Error ? error.message : String(error)))
    }
    process.exit(1)
  }
  spinner.succeed(`Found ${registryItem.name} v${registryItem.version}`)

  // Build resolvedUrl for lock file (if not set by direct URL mode)
  if (!resolvedUrl) {
    const artifactsPath = await registryClient.getArtifactsPath(registry, { cacheTtl, skipCache })
    const summary = await registryClient.getArtifactSummary(registry, artifactName, { cacheTtl, skipCache })
    resolvedUrl = buildArtifactItemUrl(
      { ...registry, artifactsPath },
      artifactName,
      summary?.path,
    )
  }

  // Validate artifact structure
  const validation = validateDownloadedArtifact(registryItem as unknown as Record<string, unknown>, artifactName)

  if (!validation.valid) {
    console.error()
    console.error(kleur.red('Artifact validation failed:'))
    for (const error of validation.errors) {
      console.error(kleur.red(`  • ${error}`))
    }
    console.error()
    console.error(kleur.yellow('The artifact from the registry may be malformed or corrupted.'))
    console.error(kleur.gray('Consider contacting the registry maintainer.'))
    process.exit(1)
  }

  if (validation.warnings.length > 0) {
    console.log()
    console.log(kleur.yellow('Artifact validation warnings:'))
    for (const warning of validation.warnings) {
      console.log(kleur.yellow(`  ⚠ ${warning}`))
    }
  }

  // Determine output format
  const format: OutputFormat = (options.output as OutputFormat) || configManager.getDefaultFormat()

  // Create artifacts directory
  const storage = new LocalFileSystem(projectRoot)
  const artifactsDir = configManager.getArtifactsDir()
  const namespaceDir = storage.joinPath(artifactsDir, artifactNamespace)
  await storage.mkdir(namespaceDir, true)

  // Prepare artifact content (remove registry-specific fields)
  const artifactContent = prepareArtifactForInstall(registryItem)
  const artifactKind = registryItem.kind as ArtifactKind

  // Determine primary file extension based on format
  const primaryExt = format === 'ts' ? 'ts' : (format === 'json' || format === 'typed') ? 'json' : 'yaml'
  const artifactFileName = `${artifactName}.${primaryExt}`

  // Validate artifact path to prevent path traversal (defense in depth)
  const sanitizedArtifactPath = sanitizePath(namespaceDir, artifactFileName)
  if (!sanitizedArtifactPath) {
    console.error(kleur.red('Invalid artifact name (path traversal detected)'))
    process.exit(1)
  }

  // Write artifact file(s) based on format
  let contentString: string
  const writtenFiles: string[] = []

  if (format === 'ts') {
    spinner.start(`Generating ${artifactFileName}...`)
    contentString = jsonToTsModule(artifactContent, {
      artifactKind,
      exportName: toCamelCase(artifactName),
    })
    await assertNotSymlink(sanitizedArtifactPath)
    await storage.writeFile(sanitizedArtifactPath, contentString)
    writtenFiles.push(artifactFileName)
    spinner.succeed(`Generated: ${join(artifactsDir, artifactNamespace, artifactFileName)}`)
  } else if (format === 'typed') {
    spinner.start(`Writing ${artifactFileName}...`)
    contentString = JSON.stringify(artifactContent, null, 2)
    await assertNotSymlink(sanitizedArtifactPath)
    await storage.writeFile(sanitizedArtifactPath, contentString)
    writtenFiles.push(artifactFileName)
    spinner.succeed(`Written: ${join(artifactsDir, artifactNamespace, artifactFileName)}`)

    const dtsFileName = `${artifactName}.json.d.ts`
    const sanitizedDtsPath = sanitizePath(namespaceDir, dtsFileName)
    if (sanitizedDtsPath) {
      spinner.start(`Generating ${dtsFileName}...`)
      const dtsContent = jsonToDts(artifactContent, `${artifactName}.json`)
      await assertNotSymlink(sanitizedDtsPath)
      await storage.writeFile(sanitizedDtsPath, dtsContent)
      writtenFiles.push(dtsFileName)
      spinner.succeed(`Generated: ${join(artifactsDir, artifactNamespace, dtsFileName)}`)
    }
  } else {
    spinner.start(`Writing ${artifactFileName}...`)
    contentString = format === 'json'
      ? JSON.stringify(artifactContent, null, 2)
      : YAML.stringify(artifactContent)
    await assertNotSymlink(sanitizedArtifactPath)
    await storage.writeFile(sanitizedArtifactPath, contentString)
    writtenFiles.push(artifactFileName)
    spinner.succeed(`Written: ${join(artifactsDir, artifactNamespace, artifactFileName)}`)
  }

  // Download layers if requested
  const downloadedLayers: Record<string, { content: Buffer; path: string }> = {}
  if (options.layers && registryItem.layers) {
    const layerKeys = parseLayerOption(options.layers, Object.keys(registryItem.layers))
    const allowedContentTypes = await configManager.getAllowedContentTypes()

    for (const layerKey of layerKeys) {
      const layer = registryItem.layers[layerKey]
      if (!layer) {
        console.warn(kleur.yellow(`Layer not found: ${layerKey}`))
        continue
      }

      if (layer.kind === 'file') {
        if (!layer.checksum) {
          console.warn(kleur.yellow(`Skipping layer "${layerKey}": missing required checksum`))
          console.warn(kleur.gray('  Layers must have a checksum for integrity verification'))
          continue
        }

        const sanitizedPath = sanitizePath(namespaceDir, layer.path)
        if (!sanitizedPath) {
          console.warn(kleur.yellow(`Invalid layer path (path traversal detected): ${layer.path}`))
          continue
        }

        // Derive layer URL from artifact's resolved URL directory + layer path
        const artifactDir = resolvedUrl!.substring(0, resolvedUrl!.lastIndexOf('/'))
        const layerUrl = `${artifactDir}/${layer.path}`

        spinner.start(`Downloading layer: ${layerKey}...`)
        try {
          const layerBuffer = Buffer.from(await registryClient.fetchLayerBinary(
            registry,
            layerUrl,
            allowedContentTypes
          ))

          const checksumResult = verifyChecksum(layerBuffer, layer.checksum)
          if (!checksumResult.valid) {
            spinner.fail(`Checksum mismatch for layer: ${layerKey}`)
            console.error(kleur.red(`  Expected: ${checksumResult.expected}`))
            console.error(kleur.red(`  Actual:   ${checksumResult.actual}`))
            console.error(kleur.gray('  The downloaded file may have been tampered with or corrupted'))
            continue
          }

          const layerDir = storage.dirname(sanitizedPath)
          await storage.mkdir(layerDir, true)

          await assertNotSymlink(sanitizedPath)
          await storage.writeFile(sanitizedPath, layerBuffer)

          downloadedLayers[layerKey] = { content: layerBuffer, path: layer.path }
          spinner.succeed(`Downloaded: ${join(artifactsDir, artifactNamespace, layer.path)}`)
        } catch (error) {
          if (error instanceof SymlinkError) {
            spinner.fail(`Security error: layer path is a symlink`)
            console.error(kleur.red(`  ${error.message}`))
            console.error(kleur.gray('  Symlinks are not allowed for security reasons'))
          } else {
            spinner.fail(`Failed to download layer: ${layerKey}`)
            console.error(kleur.red(error instanceof Error ? error.message : String(error)))
          }
        }
      }
    }
  }

  // Download ContentRef files (instructions, agentInstructions) — always, no --layers flag needed
  const contentRefFields = ['instructions', 'agentInstructions'] as const
  const downloadedContentRefs: string[] = []

  for (const field of contentRefFields) {
    const ref = registryItem[field]
    if (!ref || ref.kind !== 'file') continue

    if (!ref.checksum) {
      console.warn(kleur.yellow(`Skipping ${field} file: missing required checksum`))
      console.warn(kleur.gray('  Content files must have a checksum for integrity verification'))
      continue
    }

    const sanitizedRefPath = sanitizePath(namespaceDir, ref.path)
    if (!sanitizedRefPath) {
      console.warn(kleur.yellow(`Invalid ${field} path (path traversal detected): ${ref.path}`))
      continue
    }

    // Derive URL from artifact's resolved URL directory + ref path
    const artifactDir = resolvedUrl!.substring(0, resolvedUrl!.lastIndexOf('/'))
    const refUrl = `${artifactDir}/${ref.path}`

    spinner.start(`Downloading ${field}: ${ref.path}...`)
    try {
      const allowedContentTypes = await configManager.getAllowedContentTypes()
      const refBuffer = Buffer.from(await registryClient.fetchLayerBinary(
        registry,
        refUrl,
        allowedContentTypes
      ))

      const checksumResult = verifyChecksum(refBuffer, ref.checksum)
      if (!checksumResult.valid) {
        spinner.fail(`Checksum mismatch for ${field}: ${ref.path}`)
        console.error(kleur.red(`  Expected: ${checksumResult.expected}`))
        console.error(kleur.red(`  Actual:   ${checksumResult.actual}`))
        console.error(kleur.gray('  The downloaded file may have been tampered with or corrupted'))
        continue
      }

      const refDir = storage.dirname(sanitizedRefPath)
      await storage.mkdir(refDir, true)

      await assertNotSymlink(sanitizedRefPath)
      await storage.writeFile(sanitizedRefPath, refBuffer)

      downloadedContentRefs.push(ref.path)
      spinner.succeed(`Downloaded: ${join(artifactsDir, artifactNamespace, ref.path)}`)
    } catch (error) {
      if (error instanceof SymlinkError) {
        spinner.fail(`Security error: ${field} path is a symlink`)
        console.error(kleur.red(`  ${error.message}`))
        console.error(kleur.gray('  Symlinks are not allowed for security reasons'))
      } else {
        spinner.fail(`Failed to download ${field}: ${ref.path}`)
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
      }
    }
  }

  // Update lock file
  const isUpdate = lockFileManager.getArtifact(artifactFull) !== null
  const lockedArtifact = lockFileManager.createLockedArtifact({
    kind: artifactKind,
    version: registryItem.version,
    resolved: resolvedUrl,
    content: contentString,
    output: format,
    path: storage.relative(projectRoot, sanitizedArtifactPath),
    layers: downloadedLayers,
  })
  lockFileManager.setArtifact(artifactFull, lockedArtifact)
  await lockFileManager.save()

  // Track install for telemetry (fire and forget)
  trackInstall(
    registry.baseUrl,
    artifactName,
    registryItem.version,
    registryItem.kind,
    isUpdate,
    { hasHeaders: !!registry.headers && Object.keys(registry.headers).length > 0 }
  )

  // Success message
  console.log()
  console.log(kleur.green('✓') + ` Added ${kleur.bold(artifactFull)} v${registryItem.version}`)
  console.log()
  console.log(kleur.gray('Format:'), format)
  for (const file of writtenFiles) {
    console.log(kleur.gray('  →'), join(artifactsDir, artifactNamespace, file))
  }
  if (Object.keys(downloadedLayers).length > 0) {
    console.log(kleur.gray('Layers:'), Object.keys(downloadedLayers).join(', '))
  }
  if (downloadedContentRefs.length > 0) {
    console.log(kleur.gray('Content:'))
    for (const refPath of downloadedContentRefs) {
      console.log(kleur.gray('  →'), join(artifactsDir, artifactNamespace, refPath))
    }
  }
}

/**
 * Create the 'add' command
 * Adds artifacts from a registry into the project
 */
export function createAddCommand(): Command {
  const add = new Command('add')

  add
    .argument('<artifact>', 'Artifact reference (@namespace/name), namespace (@namespace), or direct URL (https://...)')
    .description('Add an artifact from a registry or direct URL')
    .option('--layers <layers>', 'Layers to download (comma-separated, or "all")')
    .option('--output <output>', 'Output format: json, yaml, typed (json + .d.ts), or ts (TypeScript module)')
    .option('--header <header...>', 'HTTP header for direct URL auth (format: "Name: Value")')
    .option('--cache-ttl <seconds>', 'Cache TTL in seconds (0 = no cache, default: use config)', parseInt)
    .option('--no-cache', 'Skip cache and fetch fresh')
    .action(async (artifact: string, options: AddOptions & { header?: string[]; cache?: boolean }) => {
      const spinner = ora()

      try {
        // 1. Parse artifact argument (reference, namespace-only, or direct URL)
        const parsed = parseArtifactArg(artifact)
        const nsOnly = !parsed ? parseNamespaceOnly(artifact) : null

        if (!parsed && !nsOnly) {
          console.error(kleur.red(`Invalid artifact: ${artifact}`))
          console.error(kleur.gray('Expected format:'))
          console.error(kleur.gray('  @namespace/artifact-name (registry reference)'))
          console.error(kleur.gray('  @namespace              (browse all artifacts)'))
          console.error(kleur.gray('  https://registry.example.com/r/artifact.json (direct URL)'))
          process.exit(1)
        }

        // 2. Find project root
        const projectRoot = await findRepoRoot()
        if (!projectRoot) {
          console.error(kleur.red('Not in an Paradoc project.'))
          console.error(kleur.gray("Run 'para init' to initialize a project first."))
          process.exit(1)
        }

        // Load project config
        await configManager.loadProjectManifest(projectRoot)

        // 3. Initialize lock file manager
        await lockFileManager.init(projectRoot)

        // 3b. Initialize cache with config
        const cacheDir = await configManager.getCacheDirectory()
        await registryClient.initCache({ directory: cacheDir })

        // --- Namespace-only browse mode ---
        if (nsOnly) {
          spinner.start(`Resolving registry for ${nsOnly.namespace}...`)
          const registry = await resolveRegistry(nsOnly.namespace)
          spinner.succeed(`Registry: ${registry.baseUrl}`)

          // Determine cache options
          const skipCache = options.cache === false
          const cacheTtl = skipCache ? 0 : await configManager.getEffectiveCacheTtl(
            nsOnly.namespace,
            options.cacheTtl
          )

          spinner.start(`Fetching artifact index...`)
          const index = await registryClient.fetchIndex(registry, { cacheTtl, skipCache })
          spinner.stop()

          if (index.items.length === 0) {
            console.log(kleur.yellow(`No artifacts found in ${nsOnly.namespace}`))
            return
          }

          const { selected } = await prompts({
            type: 'multiselect',
            name: 'selected',
            message: `Select artifacts to add from ${nsOnly.namespace}`,
            choices: index.items.map((item: RegistryItemSummary) => ({
              title: `${item.name} ${kleur.dim(`(${item.kind} v${item.version})`)}`,
              description: item.title || item.description || '',
              value: item,
            })),
            instructions: false,
            hint: 'Space to select, Enter to confirm',
          })

          if (!selected || selected.length === 0) {
            console.log(kleur.gray('No artifacts selected.'))
            return
          }

          // Install each selected artifact
          for (const item of selected as RegistryItemSummary[]) {
            await installArtifact({
              registry,
              artifactName: item.name,
              artifactNamespace: nsOnly.namespace,
              artifactFull: `${nsOnly.namespace}/${item.name}`,
              projectRoot,
              options,
              spinner,
            })
          }

          return
        }

        // --- Single artifact mode (existing behavior) ---
        const parsedArg = parsed!
        let registry: ResolvedRegistry
        let artifactName: string
        let artifactNamespace: string
        let artifactFull: string
        let resolvedUrl: string | undefined

        if (parsedArg.type === 'url') {
          const headers = collectHeaders(options.header)
          registry = createRegistryFromUrl(parsedArg.baseUrl, parsedArg.namespace, headers)
          artifactName = parsedArg.name
          artifactNamespace = parsedArg.namespace
          artifactFull = `${parsedArg.namespace}/${parsedArg.name}`
          resolvedUrl = parsedArg.artifactUrl

          spinner.start(`Fetching from ${parsedArg.artifactUrl}...`)
        } else {
          spinner.start(`Resolving registry for ${parsedArg.ref.namespace}...`)
          registry = await resolveRegistry(parsedArg.ref.namespace)
          artifactName = parsedArg.ref.name
          artifactNamespace = parsedArg.ref.namespace
          artifactFull = parsedArg.ref.full

          spinner.succeed(`Registry: ${registry.baseUrl}`)
        }

        await installArtifact({
          registry,
          artifactName,
          artifactNamespace,
          artifactFull,
          resolvedUrl,
          projectRoot,
          options,
          spinner,
        })
      } catch (error) {
        spinner.fail('Failed')
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  return add
}

/**
 * Prepare artifact content for installation
 * Removes registry-specific fields ($schema)
 */
function prepareArtifactForInstall(registryItem: RegistryItem): Record<string, unknown> {
  const { $schema: _schema, ...rest } = registryItem

  // Build result with artifact fields
  const result: Record<string, unknown> = { ...rest }

  return result
}

/**
 * Parse the --layers option
 * @param layersOption - "all" or comma-separated layer keys
 * @param availableLayers - List of available layer keys
 */
function parseLayerOption(layersOption: string, availableLayers: string[]): string[] {
  if (layersOption.toLowerCase() === 'all') {
    return availableLayers
  }
  return layersOption.split(',').map((s) => s.trim()).filter(Boolean)
}

/**
 * Convert kebab-case to camelCase for export names
 * @example "w9-form" -> "w9Form"
 */
function toCamelCase(str: string): string {
  return str.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase())
}

/**
 * Collect headers from command-line options
 * @param headerArgs - Array of "Name: Value" strings
 * @returns Record of headers or undefined if none
 */
function collectHeaders(headerArgs?: string[]): Record<string, string> | undefined {
  if (!headerArgs || headerArgs.length === 0) {
    return undefined
  }

  const headers: Record<string, string> = {}
  for (const header of headerArgs) {
    const colonIndex = header.indexOf(':')
    if (colonIndex === -1) {
      console.warn(`Invalid header format (expected "Name: Value"): ${header}`)
      continue
    }
    const name = header.substring(0, colonIndex).trim()
    const value = header.substring(colonIndex + 1).trim()
    if (name && value) {
      headers[name] = value
    }
  }

  return Object.keys(headers).length > 0 ? headers : undefined
}
