import { Command } from 'commander'
import kleur from 'kleur'
import { dirname, extname, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { isForm, parse, reactLayersOf, validate, type Form } from '@paradoc/core'
import type { checkComposition, CompositionCheckResult } from '@paradoc/react/check'
import type * as Discovery from '@paradoc/react/discovery'
import type { bindComponent } from '@paradoc/react/pdf'
import type { DocumentData } from '@paradoc/react'

import { readTextInput, resolveArtifactTarget } from '../utils/io.js'
import { LocalFileSystem } from '../utils/local-fs.js'
import { normalizeFormData, parseDataInput } from '../utils/data-input.js'
import { findRepoRoot } from '../utils/project.js'
import { rendererManager } from '../utils/renderer-manager.js'
import { ensureTsLoader } from '../utils/ts-loader.js'

type AdapterName = 'takumi' | 'chromium'

interface CheckOptions {
  layer?: string
  data?: string
  adapter?: string
}

/** The composition's artifact, resolved to the one layer being checked. */
interface ResolvedLayer {
  artifactPath: string
  artifactDir: string
  artifact: Form
  layer: { key: string; path: string; mimeType: string }
}

const REACT_EXTENSIONS = new Set(['.tsx', '.jsx'])

/**
 * `@paradoc/react` carries a WebAssembly PDF layout engine, fonts, and React
 * itself — real weight that most `paradoc` installs never touch. It is installed
 * on first use into `~/.paradoc/renderers`, the same as `@paradoc/render`
 * (see `renderer-manager.ts`), rather than shipped with every install.
 */
async function loadBindComponent(): Promise<typeof bindComponent> {
  try {
    const mod = await rendererManager.loadModule('@paradoc/react/pdf')
    return mod.bindComponent as typeof bindComponent
  } catch (error) {
    throw new Error(
      `Could not install or load @paradoc/react, needed to bind the composition to its module: ` +
        `${error instanceof Error ? error.message : String(error)}`
    )
  }
}

async function loadCheckComposition(): Promise<typeof checkComposition> {
  try {
    const mod = await rendererManager.loadModule('@paradoc/react/check')
    return mod.checkComposition as typeof checkComposition
  } catch (error) {
    throw new Error(
      `Could not install or load @paradoc/react, needed to check the composition: ` +
        `${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * The conventions, from the package that owns them.
 *
 * Which artifact renders a composition and where its sample data comes from are
 * questions `paradoc dev` asks of the same project, so both commands read one
 * answer (`@paradoc/react/discovery`) rather than each deriving its own. A rule
 * only one of them implemented would make a composition that previews fail a
 * check, or the reverse, for a reason about the tools rather than the document.
 */
async function loadDiscovery(): Promise<typeof Discovery> {
  try {
    return (await rendererManager.loadModule('@paradoc/react/discovery')) as unknown as typeof Discovery
  } catch (error) {
    throw new Error(
      `Could not install or load @paradoc/react, needed to find the composition's artifact: ` +
        `${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export function createCheckCommand(): Command {
  const check = new Command('check')

  check
    .argument('<target>', 'Composition file (.tsx/.jsx) or the artifact file that declares it')
    .description('Check a composition against its artifact without rendering a PDF')
    .option('--layer <key>', 'React layer key to check, when the artifact declares more than one')
    .option('--data <pathOrJson>', 'Sample data: file path or inline JSON (overrides a discovered sample)')
    .option('--adapter <name>', 'Adapter whose class vocabulary to check against: takumi|chromium', 'takumi')
    .action(async (target: string, options: CheckOptions) => {
      try {
        const adapter = normalizeAdapter(options.adapter)
        const resolvedTarget = await resolveArtifactTarget(target)
        const resolved = await resolveCompositionLayer(resolvedTarget, options.layer)
        const compositionPath = resolve(resolved.artifactDir, resolved.layer.path)

        await ensureTsLoader(dirname(compositionPath))
        const bind = await loadBindComponent()
        const composition = await bind(
          { type: 'react', mimeType: resolved.layer.mimeType, key: resolved.layer.key, path: resolved.layer.path },
          { baseDir: resolved.artifactDir }
        )

        const data = options.data
          ? await explicitData(options.data)
          : await discoverSampleData(compositionPath)

        const runCheck = await loadCheckComposition()
        const result = await runCheck({
          artifact: resolved.artifact,
          composition,
          data,
          adapter,
        })

        printResult(compositionPath, resolved.artifactPath, result)

        if (offenderCount(result) > 0) process.exitCode = 1
      } catch (error) {
        console.error(kleur.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
        process.exit(1)
      }
    })

  return check
}

function normalizeAdapter(value: string | undefined): AdapterName {
  if (value === undefined || value === 'takumi') return 'takumi'
  if (value === 'chromium') return 'chromium'
  throw new Error(`Unknown adapter "${value}". Use "takumi" or "chromium".`)
}

function offenderCount(result: CompositionCheckResult): number {
  return result.unsupportedClasses.length + result.unresolvedPaths.length + result.missingImages.length
}

/** Resolves `target` — a composition file or an artifact file — to the one React layer being checked. */
async function resolveCompositionLayer(target: string, layerKey: string | undefined): Promise<ResolvedLayer> {
  if (REACT_EXTENSIONS.has(extname(target).toLowerCase())) {
    return findArtifactForComposition(target, layerKey)
  }
  return loadArtifactLayer(target, layerKey)
}

/** `target` is the artifact: parse it, validate it, and pick the React layer it declares. */
async function loadArtifactLayer(target: string, layerKey: string | undefined): Promise<ResolvedLayer> {
  const { raw, sourcePath, baseDir } = await readTextInput(target)
  if (!sourcePath) {
    throw new Error('Cannot resolve a React layer from stdin. Pass the artifact file by path.')
  }

  const artifact = parseFormArtifact(raw, target)
  const layer = pickLayer(reactLayersOf(artifact), layerKey, target)
  return { artifactPath: sourcePath, artifactDir: baseDir, artifact, layer }
}

/**
 * `target` is the composition itself: find the artifact that renders it through
 * the shared conventions.
 *
 * A layer's path is relative to the artifact file that declares it, so an
 * artifact and its composition may live apart and the search covers the whole
 * project. When no layer points at the composition, an artifact file of the
 * same name beside it is taken instead — the fallback `paradoc dev` also applies,
 * so a composition written before its layer entry is checkable and previewable
 * on the same terms.
 *
 * Scoped by `findRepoRoot()`, the same project boundary `diff` and `cache`
 * use — the directory carrying both `paradoc.json` and `.paradoc`, not merely
 * a `.paradoc` directory (see `project.ts` for why that distinction matters).
 * Falls back to `process.cwd()` outside a project.
 */
async function findArtifactForComposition(
  target: string,
  layerKey: string | undefined
): Promise<ResolvedLayer> {
  const storage = new LocalFileSystem()
  const compositionAbs = storage.getAbsolutePath(target)
  if (!(await storage.exists(compositionAbs))) {
    throw new Error(`File not found: ${target}`)
  }

  const root = (await findRepoRoot()) ?? process.cwd()
  const discovery = await loadDiscovery()
  const { byLayer } = await discovery.findCompositionArtifact(root, compositionAbs)

  const matches: ResolvedLayer[] = byLayer.map((match) => ({
    artifactPath: match.file,
    artifactDir: dirname(match.file),
    artifact: match.artifact,
    layer: { key: match.layer!, path: relative(dirname(match.file), compositionAbs), mimeType: match.mimeType! },
  }))

  if (layerKey) {
    const named = matches.filter((match) => match.layer.key === layerKey)
    if (named.length === 1) return validatedLayer(named[0]!)
  } else if (matches.length === 1) {
    return validatedLayer(matches[0]!)
  }

  if (matches.length > 1) {
    throw new Error(
      `${matches.length} artifacts declare a React layer pointing at ${relative(root, compositionAbs)}:\n` +
        matches.map((match) => `  - ${match.artifactPath} (layer "${match.layer.key}")`).join('\n') +
        '\nPass the artifact file directly, or narrow with --layer.'
    )
  }

  // Nothing points at it. The other half of the pairing rule: an artifact file
  // of the same name beside the composition.
  const sibling = await discovery.siblingArtifact(root, compositionAbs)
  if (sibling) {
    const layers = reactLayersOf(sibling.artifact)
    const layer = layers.length > 0 ? pickLayer(layers, layerKey, sibling.file) : undefined
    return validatedLayer({
      artifactPath: sibling.file,
      artifactDir: dirname(sibling.file),
      artifact: sibling.artifact,
      layer: layer ?? {
        key: 'composition',
        path: relative(dirname(sibling.file), compositionAbs),
        mimeType: 'text/tsx',
      },
    })
  }

  throw new Error(
    `${discovery.UNPAIRED_MESSAGE} Looked under ${root} for ` +
      `${relative(root, compositionAbs)}. Pass the artifact file instead.`
  )
}

/** Holds a matched artifact to the schema, which loose pairing deliberately does not. */
function validatedLayer(resolved: ResolvedLayer): ResolvedLayer {
  const validation = validate(resolved.artifact)
  if (validation.issues) {
    const issues = validation.issues
      .map((issue) => `  - ${issue.path?.length ? issue.path.join('.') : 'root'}: ${issue.message}`)
      .join('\n')
    throw new Error(`"${resolved.artifactPath}" is not a valid artifact:\n${issues}`)
  }
  return resolved
}

/** Parses and validates an artifact, requiring a form that declares at least one React layer. */
function parseFormArtifact(raw: string, label: string): Form {
  const parsed = parse(raw)
  const validation = validate(parsed)
  if (validation.issues) {
    const issues = validation.issues
      .map((issue) => `  - ${issue.path?.length ? issue.path.join('.') : 'root'}: ${issue.message}`)
      .join('\n')
    throw new Error(`"${label}" is not a valid artifact:\n${issues}`)
  }
  if (!isForm(validation.value)) {
    throw new Error(`"${label}" is not a form artifact. Only forms declare React layers today.`)
  }
  return validation.value as Form
}

function pickLayer(
  layers: { key: string; path: string; mimeType: string }[],
  layerKey: string | undefined,
  label: string
): { key: string; path: string; mimeType: string } {
  if (layers.length === 0) {
    throw new Error(`"${label}" declares no React layer (text/tsx or text/jsx).`)
  }
  if (layerKey) {
    const found = layers.find((layer) => layer.key === layerKey)
    if (!found) {
      throw new Error(
        `"${label}" has no layer named "${layerKey}". Layers: ${layers.map((layer) => layer.key).join(', ')}`
      )
    }
    return found
  }
  if (layers.length > 1) {
    throw new Error(
      `"${label}" declares ${layers.length} React layers (${layers.map((layer) => layer.key).join(', ')}). ` +
        'Pass --layer to pick one.'
    )
  }
  return layers[0]!
}

/** `--data` explicitly overrides sample discovery. */
async function explicitData(value: string): Promise<DocumentData> {
  const { data } = await parseDataInput(value)
  const normalized = normalizeFormData(data)
  return {
    fields: normalized.fields,
    parties: (normalized.parties as DocumentData['parties']) ?? {},
  }
}

/**
 * Sample data for the composition, if any is discoverable.
 *
 * The order is the shared one (`@paradoc/react/discovery`): a sibling
 * `<composition>.sample.{ts,tsx,js,mjs,jsx}` first, then a named `sample`
 * export on the composition module. `paradoc dev` reads the same order, so a
 * composition previews with the data it is checked against.
 *
 * Only a sibling's `default` counts as a sample. The composition module's own
 * default is the component; calling that as though it were a zero-argument
 * sample function is a different bug, so only its named `sample` is read.
 *
 * Nothing found, the check runs with empty fields and parties: every `Field`
 * and `Table` path still resolves against the artifact's schema, which does not
 * depend on data being present.
 */
async function discoverSampleData(compositionPath: string): Promise<DocumentData | undefined> {
  const discovery = await loadDiscovery()
  const root = (await findRepoRoot()) ?? process.cwd()

  for (const source of await discovery.sampleSources(root, compositionPath)) {
    const sample = await sampleFromModule(source.file, {
      allowDefaultExport: source.from === 'sibling',
    })
    if (sample) return sample
  }
  return undefined
}

async function sampleFromModule(
  modulePath: string,
  options: { allowDefaultExport: boolean }
): Promise<DocumentData | undefined> {
  let module: Record<string, unknown>
  try {
    module = (await import(/* @vite-ignore */ pathToFileURL(modulePath).href)) as Record<string, unknown>
  } catch {
    return undefined
  }

  const exported = module.sample ?? (options.allowDefaultExport ? module.default : undefined)
  if (exported === undefined) return undefined
  const resolved = typeof exported === 'function' ? await (exported as () => unknown)() : exported
  return isDocumentData(resolved) ? resolved : undefined
}

function isDocumentData(value: unknown): value is DocumentData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'fields' in value &&
    typeof (value as { fields: unknown }).fields === 'object'
  )
}

function printResult(compositionPath: string, artifactPath: string, result: CompositionCheckResult): void {
  console.log(kleur.gray(`Composition: ${compositionPath}`))
  console.log(kleur.gray(`Artifact:    ${artifactPath}`))
  console.log()

  if (offenderCount(result) === 0) {
    console.log(kleur.green('✓ No unsupported classes, unresolved paths, or missing images.'))
    return
  }

  if (result.unsupportedClasses.length > 0) {
    console.log(kleur.red(`Unsupported classes (${result.unsupportedClasses.length}):`))
    for (const name of result.unsupportedClasses) {
      console.log(`  - ${name} — ${kleur.gray(compositionPath)}`)
    }
    console.log()
  }

  if (result.unresolvedPaths.length > 0) {
    console.log(kleur.red(`Unresolved field paths (${result.unresolvedPaths.length}):`))
    for (const path of result.unresolvedPaths) {
      console.log(`  - ${path} — ${kleur.gray(artifactPath)}`)
    }
    console.log()
  }

  if (result.missingImages.length > 0) {
    console.log(kleur.yellow(`Images with no embedded bytes (${result.missingImages.length}):`))
    for (const src of result.missingImages) {
      console.log(`  - ${src} — ${kleur.gray(compositionPath)}`)
    }
    console.log()
  }
}
