import { Command } from 'commander'
import kleur from 'kleur'
import ora, { type Ora } from 'ora'
import prompts from 'prompts'
import { assertCurrentSchemaVersion, validate, type Artifact } from '@paradoc/core'
import { LocalFileSystem } from '../utils/local-fs.js'

import type { AddOptions, OutputFormat, ArtifactKind, ResolvedRegistry, RegistryItemSummary } from '../types.js'
import { parseArtifactArg, resolveRegistry, createRegistryFromUrl, parseNamespaceOnly } from '../utils/registry.js'
import { addComponents, COMPONENT_ITEMS, COMPONENT_NAMESPACE, isComponentName } from './add-component.js'
import { registryClient, RegistryFetchError, type RegistryItem } from '../utils/registry-client.js'
import { lockFileManager } from '../utils/lock.js'
import { configManager } from '../utils/config.js'
import { findRepoRoot } from '../utils/project.js'
import { PROJECT_REQUIRED_MESSAGE } from '../utils/user-copy.js'
import { sanitizePath, validateDownloadedArtifact, assertNotSymlink, SymlinkError } from '../utils/security.js'
import { verifyChecksum } from '../utils/hash.js'
import { trackInstall } from '../utils/telemetry.js'
import { collectHeader } from '../utils/cli-helpers.js'
import { join } from 'node:path'
import { serializeArtifactFile } from '../utils/artifact-file.js'
import { writeTypedOutput } from '../utils/typed-output.js'

interface InstallArtifactOpts {
  registry: ResolvedRegistry
  artifactName: string
  artifactNamespace: string
  artifactFull: string
  resolvedUrl?: string
  projectRoot: string
  options: AddOptions & { header: Record<string, string>; cache?: boolean }
  spinner: Ora
}

/** A downloaded file whose checksum matched, waiting to be written */
interface VerifiedFile {
  path: string
  destination: string
  content: Buffer
}

/** A file the artifact references that could not be downloaded or verified */
interface FileFailure {
  label: string
  path: string
  cause: string
}

/**
 * The artifact a registry item installs: the item without the registry
 * metadata the artifact schema does not carry (search `tags` and each file
 * layer's download `url`).
 */
function toInstalledArtifact(item: RegistryItem): Record<string, unknown> {
  const { tags: _tags, ...rest } = item
  const artifact: Record<string, unknown> = { ...rest }
  if (item.layers) {
    artifact.layers = Object.fromEntries(
      Object.entries(item.layers).map(([key, layer]) => {
        if (layer.kind !== 'file') return [key, layer]
        const { url: _url, ...installed } = layer
        return [key, installed]
      }),
    )
  }
  return artifact
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
  let registryTelemetry = { enableTelemetry: true, enableDirectory: true }
  try {
    const fetched = resolvedUrl
      ? await registryClient.fetchItemUrl(resolvedUrl, registry.headers)
      : await registryClient.fetchItem(registry, artifactName, { cacheTtl, skipCache })
    registryItem = fetched.item
    resolvedUrl ??= fetched.url
    if (!opts.resolvedUrl) {
      const index = await registryClient.fetchIndex(registry, { cacheTtl, skipCache })
      registryTelemetry = {
        enableTelemetry: index.enableTelemetry !== false,
        enableDirectory: index.enableDirectory !== false,
      }
    }
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

  // A registry serves artifact files, so the schema version rule for files applies.
  try {
    assertCurrentSchemaVersion(registryItem, { required: true })
  } catch (error) {
    console.error(kleur.red(error instanceof Error ? error.message : String(error)))
    console.error(kleur.gray(`The registry serves ${artifactFull} for another schema version; its maintainer can upgrade it with paradoc migrate.`))
    process.exit(1)
  }

  // Core owns artifact structure validation.
  const artifactContent = toInstalledArtifact(registryItem)
  const artifactValidation = validate(artifactContent)
  if (artifactValidation.issues) {
    console.error()
    console.error(kleur.red(`${artifactFull} from the registry is not a valid artifact:`))
    for (const issue of artifactValidation.issues) {
      const location = issue.path?.length ? issue.path.map(String).join('.') : 'root'
      console.error(kleur.red(`  • ${location}: ${issue.message}`))
    }
    console.error(kleur.gray('Nothing was installed. Consider contacting the registry maintainer.'))
    process.exit(1)
  }

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

  const storage = new LocalFileSystem(projectRoot)
  const artifactsDir = configManager.getArtifactsDir()
  const namespaceDir = storage.joinPath(artifactsDir, artifactNamespace)

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

  // Download and verify every file the artifact brings with it before anything
  // is written. The artifact file references these files, so one that fails to
  // download or verify fails the whole install: nothing lands on disk, and the
  // lock file does not record an install that did not happen.
  const artifactDir = resolvedUrl!.substring(0, resolvedUrl!.lastIndexOf('/'))
  const allowedContentTypes = await configManager.getAllowedContentTypes()
  const verifiedFiles: VerifiedFile[] = []
  const failures: FileFailure[] = []

  const fetchVerified = async (label: string, filePath: string, destination: string, checksum: string, sourceUrl = `${artifactDir}/${filePath}`): Promise<Buffer | null> => {
    spinner.start(`Downloading ${label}: ${filePath}...`)
    let cause: string
    try {
      const content = Buffer.from(await registryClient.fetchLayerBinary(
        registry,
        sourceUrl,
        allowedContentTypes
      ))
      const checksumResult = verifyChecksum(content, checksum)
      if (checksumResult.valid) {
        await assertNotSymlink(destination)
        verifiedFiles.push({ path: filePath, destination, content })
        spinner.succeed(`Verified ${label}: ${filePath}`)
        return content
      }
      cause = `checksum mismatch (expected ${checksumResult.expected}, got ${checksumResult.actual}); the file may have been tampered with or corrupted`
    } catch (error) {
      cause = error instanceof SymlinkError
        ? `the destination is a symlink, which is not allowed (${error.message})`
        : error instanceof Error ? error.message : String(error)
    }
    spinner.fail(`Failed ${label}: ${filePath}`)
    failures.push({ label, path: filePath, cause })
    return null
  }

  // Layers, when requested
  const downloadedLayers: Record<string, { content: Buffer; path: string }> = {}
  if (options.layers && registryItem.layers) {
    const layerKeys = parseLayerOption(options.layers, Object.keys(registryItem.layers))

    for (const layerKey of layerKeys) {
      const layer = registryItem.layers[layerKey]
      if (!layer) {
        failures.push({ label: `layer "${layerKey}"`, path: layerKey, cause: 'requested layer is not declared by the artifact' })
        continue
      }
      if (layer.kind !== 'file') continue

      if (!layer.checksum) {
        failures.push({ label: `layer "${layerKey}"`, path: layer.path, cause: 'missing required checksum' })
        continue
      }

      const sanitizedPath = sanitizePath(namespaceDir, layer.path)
      if (!sanitizedPath) {
        failures.push({ label: `layer "${layerKey}"`, path: layer.path, cause: 'path traversal detected' })
        continue
      }

      const layerContent = await fetchVerified(`layer "${layerKey}"`, layer.path, sanitizedPath, layer.checksum, layer.url ?? `${artifactDir}/${layer.path}`)
      if (layerContent) {
        downloadedLayers[layerKey] = { content: layerContent, path: layer.path }
      }

      // A declared font travels with its layer, verified the same way.
      if (layer.font) {
        if (!layer.font.checksum) {
          failures.push({ label: `font of layer "${layerKey}"`, path: layer.font.path, cause: 'missing required checksum' })
          continue
        }
        const sanitizedFontPath = sanitizePath(namespaceDir, layer.font.path)
        if (!sanitizedFontPath) {
          failures.push({ label: `font of layer "${layerKey}"`, path: layer.font.path, cause: 'path traversal detected' })
          continue
        }
        await fetchVerified(`font of layer "${layerKey}"`, layer.font.path, sanitizedFontPath, layer.font.checksum)
      }
    }
  }

  // ContentRef files (instructions, agentInstructions): always, no --layers flag needed
  const contentRefFields = ['instructions', 'agentInstructions'] as const
  const downloadedContentRefs: string[] = []

  for (const field of contentRefFields) {
    const ref = registryItem[field]
    if (!ref || ref.kind !== 'file') continue

    if (!ref.checksum) {
      failures.push({ label: field, path: ref.path, cause: 'missing required checksum' })
      continue
    }

    const sanitizedRefPath = sanitizePath(namespaceDir, ref.path)
    if (!sanitizedRefPath) {
      failures.push({ label: field, path: ref.path, cause: 'path traversal detected' })
      continue
    }

    if (await fetchVerified(field, ref.path, sanitizedRefPath, ref.checksum)) {
      downloadedContentRefs.push(ref.path)
    }
  }

  if (failures.length > 0) {
    console.error()
    console.error(kleur.red(`Could not add ${artifactFull} v${registryItem.version}: ${failures.length === 1 ? '1 file' : `${failures.length} files`} failed to download or verify.`))
    for (const failure of failures) {
      console.error(kleur.red(`  • ${failure.label} (${failure.path}): ${failure.cause}`))
    }
    console.error(kleur.gray('Nothing was installed. Try again, or contact the registry maintainer if it keeps failing.'))
    process.exit(1)
  }

  await storage.mkdir(namespaceDir, true)

  // Write artifact file(s) based on format
  let contentString = serializeArtifactFile(artifactContent, 'json')
  const writtenFiles: string[] = []

  if (format === 'ts') {
    spinner.start(`Generating ${artifactFileName}...`)
    await writeTypedOutput(storage, {
      artifact: artifactContent as unknown as Artifact,
      format,
      primaryPath: sanitizedArtifactPath,
      beforeWrite: assertNotSymlink,
    })
    writtenFiles.push(artifactFileName)
    spinner.succeed(`Generated: ${join(artifactsDir, artifactNamespace, artifactFileName)}`)

    const sourceFileName = `${artifactName}.json`
    const sourcePath = sanitizePath(namespaceDir, sourceFileName)
    if (!sourcePath) throw new Error('Invalid artifact source path')
    contentString = serializeArtifactFile(artifactContent, 'json')
    await assertNotSymlink(sourcePath)
    await storage.writeFile(sourcePath, contentString)
    writtenFiles.push(sourceFileName)
  } else if (format === 'typed') {
    spinner.start(`Writing ${artifactFileName}...`)
    await writeTypedOutput(storage, {
      artifact: artifactContent as unknown as Artifact,
      format,
      primaryPath: sanitizedArtifactPath,
      sourceJsonPath: sanitizedArtifactPath,
      beforeWrite: assertNotSymlink,
    })
    writtenFiles.push(artifactFileName)
    spinner.succeed(`Written: ${join(artifactsDir, artifactNamespace, artifactFileName)}`)

    const dtsFileName = `${artifactName}.json.d.ts`
    const sanitizedDtsPath = sanitizePath(namespaceDir, dtsFileName)
    if (sanitizedDtsPath) {
      spinner.start(`Generating ${dtsFileName}...`)
      writtenFiles.push(dtsFileName)
      spinner.succeed(`Generated: ${join(artifactsDir, artifactNamespace, dtsFileName)}`)
    }
  } else {
    spinner.start(`Writing ${artifactFileName}...`)
    contentString = serializeArtifactFile(artifactContent, format)
    await assertNotSymlink(sanitizedArtifactPath)
    await storage.writeFile(sanitizedArtifactPath, contentString)
    writtenFiles.push(artifactFileName)
    spinner.succeed(`Written: ${join(artifactsDir, artifactNamespace, artifactFileName)}`)
  }

  // Write the verified files the artifact references
  for (const file of verifiedFiles) {
    await storage.mkdir(storage.dirname(file.destination), true)
    await assertNotSymlink(file.destination)
    await storage.writeFile(file.destination, file.content)
  }

  // Update lock file
  const isUpdate = lockFileManager.getArtifact(artifactFull) !== null
  const lockArtifactPath = format === 'ts'
    ? sanitizePath(namespaceDir, `${artifactName}.json`)!
    : sanitizedArtifactPath
  const lockedArtifact = lockFileManager.createLockedArtifact({
    kind: artifactKind,
    version: registryItem.version,
    resolved: resolvedUrl,
    content: contentString,
    output: format,
    path: storage.relative(projectRoot, lockArtifactPath),
    layers: downloadedLayers,
  })
  lockFileManager.setArtifact(artifactFull, lockedArtifact)
  await lockFileManager.save()

  // Track install for telemetry (fire and forget)
  trackInstall(
    registry.configuredUrl ?? registry.baseUrl,
    artifactName,
    registryItem.version,
    registryItem.kind,
    isUpdate,
    {
      hasHeaders: !!registry.headers && Object.keys(registry.headers).length > 0,
      ...registryTelemetry,
    }
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

/** A name with no namespace, path, or scheme, such as `w9`. */
const BARE_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/

/**
 * Create the 'add' command
 * Adds artifacts from a registry into the project
 */
export function createAddCommand(): Command {
  const add = new Command('add')

  add
    .argument('<targets...>', 'Artifact reference (@namespace/name), namespace (@namespace), direct URL (https://...), or one or more document component names')
    .description('Add an artifact from a registry, or one or more document components from the Paradoc component registry')
    .option('--layers <layers>', 'Layers to download (comma-separated, or "all")')
    .option('--output <output>', 'Output format: json, yaml, typed (json + .d.ts), or ts (TypeScript module)')
    .option('--header <header>', 'HTTP header for direct URL auth (format: "Name: Value"). Can be used multiple times.', collectHeader, {})
    .option('--cache-ttl <seconds>', 'Cache TTL in seconds (0 = no cache, default: use config)', parseInt)
    .option('--no-cache', 'Skip cache and fetch fresh')
    .option('--registry <url>', `Component registry URL template for ${COMPONENT_NAMESPACE} (must contain {name})`)
    .option('--dry-run', 'For a component, print the install command instead of running it')
    .action(async (targets: string[], options: AddOptions & { header: Record<string, string>; cache?: boolean; registry?: string; dryRun?: boolean }) => {
      const spinner = ora()

      try {
        if (options.output && !['json', 'yaml', 'typed', 'ts'].includes(options.output)) {
          console.error(kleur.red(`Invalid output format: ${options.output}`))
          process.exit(1)
        }
        // 0. A known item name is a document component, installed through the
        // shadcn CLI. Everything else is an artifact, which is always
        // namespaced or a URL, so the two cannot be confused for one another.
        // A bare name that is not an item falls through and is rejected below,
        // naming both forms, rather than reaching the shadcn CLI to 404.
        //
        // `paradoc add` is variadic so several components install in one call:
        // more than one target requires every one of them to be a known
        // component (mixing a component with an artifact reference, or
        // naming more than one artifact, is not supported), and each target
        // gets its own reported result even though the underlying shadcn
        // install is one combined invocation.
        if (targets.length > 1) {
          const unknown = targets.filter((target) => !isComponentName(target))
          if (unknown.length > 0) {
            console.error(
              kleur.red(
                `Not a document component: ${unknown.join(', ')}. ` +
                  'Several targets in one `paradoc add` must all be component names ' +
                  `(${COMPONENT_ITEMS.join(', ')}); an artifact reference is added one at a time.`,
              ),
            )
            process.exit(1)
          }

          // One `addComponents` call per name, not one combined shadcn
          // invocation for all of them: each name's result has to be real,
          // and a single call sharing one exit code across several items
          // cannot tell a failure in one from a failure in all. shadcn is
          // fast enough per item that this costs nothing worth avoiding.
          let exitCode = 0
          for (const target of targets) {
            const code = await addComponents([target], {
              registry: options.registry,
              dryRun: options.dryRun,
            })
            if (!options.dryRun) {
              console.log(code === 0 ? kleur.green(`✓ Added ${target}`) : kleur.red(`✗ ${target}`))
            }
            if (code !== 0) exitCode = code
          }
          if (exitCode !== 0) process.exit(exitCode)
          return
        }

        const artifact = targets[0]!

        if (isComponentName(artifact)) {
          const code = await addComponents([artifact], {
            registry: options.registry,
            dryRun: options.dryRun,
          })
          if (code !== 0) process.exit(code)
          return
        }

        // 1. Parse artifact argument (reference, namespace-only, or direct URL)
        const parsed = parseArtifactArg(artifact)
        const nsOnly = !parsed ? parseNamespaceOnly(artifact) : null

        // An artifact always names its registry; there is no default namespace.
        if (!parsed && !nsOnly && BARE_NAME_PATTERN.test(artifact)) {
          console.error(kleur.red(`"${artifact}" is not a document component.`))
          console.error(kleur.gray(`To add an artifact, name its registry: paradoc add @registry/${artifact}`))
          console.error(kleur.gray(`Document components: ${COMPONENT_ITEMS.join(', ')}`))
          process.exit(1)
        }

        if (!parsed && !nsOnly) {
          console.error(kleur.red(`Invalid artifact: ${artifact}`))
          console.error(kleur.gray('Expected format:'))
          console.error(kleur.gray('  @namespace/artifact-name (registry reference)'))
          console.error(kleur.gray('  @namespace              (browse all artifacts)'))
          console.error(kleur.gray('  https://registry.example.com/r/artifact.json (direct URL)'))
          console.error(kleur.gray(`  field                   (document component: ${COMPONENT_ITEMS.join(', ')})`))
          process.exit(1)
        }

        // 2. Find project root
        const projectRoot = await findRepoRoot()
        if (!projectRoot) {
          console.error(kleur.red(PROJECT_REQUIRED_MESSAGE))
          console.error(kleur.gray("Run 'paradoc init' to initialize a project first."))
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
          const headers = Object.keys(options.header).length > 0 ? options.header : undefined
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
