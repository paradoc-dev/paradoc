import { Command } from 'commander'
import kleur from 'kleur'
import {
  parse,
  validate,
  renderLayer,
  resolveLayerKey,
  isForm,
  form as formApi,
  type Artifact,
  type Layer,
  type Form,
} from '@paradoc/core'
import { rendererManager } from '../utils/renderer-manager.js'
import { LocalFileSystem } from '../utils/local-fs.js'

import { readTextInput, resolveArtifactTarget } from '../utils/io.js'
import { parseDataInput, normalizeFormData } from '../utils/data-input.js'

type OutputFormat = 'json' | 'pretty'

interface RenderOptions {
  data?: string
  bindings?: string
  out?: string
  format?: OutputFormat
  dryRun?: boolean
  layer?: string
}

export function createRenderCommand(): Command {
  const render = new Command('render')

  render
    .argument('<artifact>', 'Artifact file (JSON/YAML) or "-" for stdin')
    .description('Render an artifact layer')
    .option('--data <pathOrJson>', 'Data payload: file path, "-" for stdin, or inline JSON (for field substitution)')
    .option('--bindings <pathOrJson>', 'Renderer bindings (path to JSON/YAML or inline JSON)')
    .option('--out <file>', 'Write output to file (defaults to stdout)')
    .option('--format <style>', 'Summary format: pretty|json', 'pretty')
    .option('--layer <key>', 'Layer key to use (defaults to artifact.defaultLayer)')
    .option('--dry-run', 'Validate and resolve layer without rendering')
    .action(async (artifactTarget: string, options: RenderOptions) => {
      try {
        const format = normalizeFormatOption(options.format ?? 'pretty')
        const resolvedTarget = await resolveArtifactTarget(artifactTarget)
        const { raw, sourcePath, baseDir } = await readTextInput(resolvedTarget)
        const parsed = parse(raw)

        const validation = validate(parsed)
        if (validation.issues) {
          const issues = validation.issues.map((issue) => ({
            message: issue.message,
            path: issue.path?.map((segment) => String(segment)),
          }))
          printIssues(issues)
          process.exitCode = 1
          return
        }

        const artifact = validation.value as Artifact

        // Check if artifact has layers
        if (!('layers' in artifact) || !artifact.layers || Object.keys(artifact.layers).length === 0) {
          throw new Error('Artifact has no layers defined.')
        }

        const layers = artifact.layers as Record<string, Layer>
        const defaultLayer = 'defaultLayer' in artifact ? (artifact.defaultLayer as string | undefined) : undefined

        // Resolve which layer to use
        const layerKey = resolveLayerKey(layers, undefined, defaultLayer, { layer: options.layer })
        const layer = layers[layerKey]!

        if (options.dryRun) {
          printDryRunSummary({
            artifact,
            layerKey,
            layer,
            sourcePath,
            format,
          })
          return
        }

        const storage = new LocalFileSystem(baseDir)

        // Create a resolver for file-backed layers
        const resolver = {
          read: async (path: string): Promise<Uint8Array> => {
            const buffer = await storage.readFile(path, 'binary')
            return new Uint8Array(buffer)
          },
        }

        // Determine the content to output
        let content: string | Uint8Array

        // Parse bindings if provided
        const parsedBindings = options.bindings
          ? (await parseDataInput(options.bindings)).data as Record<string, string>
          : undefined

        if (options.data && isForm(artifact)) {
          // Parse data from file, stdin, or inline JSON
          const { data: rawData, source: dataSource } = await parseDataInput(options.data)
          const normalizedData = normalizeFormData(rawData)

          const formInstance = formApi.from(artifact as Form)

          const mod = await rendererManager.loadModule('@paradoc/render')
          const renderer = (mod.renderLayer as (...args: never[]) => any)()
          content = await formInstance.render({
            renderer,
            resolver,
            data: normalizedData,
            layer: layerKey,
            bindings: parsedBindings,
          })

          // Log data source if not writing to file (when outputting to stdout)
          if (!options.out && format === 'pretty') {
            const sourceDesc = dataSource === 'stdin' ? 'stdin' : dataSource === 'inline' ? 'inline JSON' : options.data
            console.error(kleur.gray(`Data from: ${sourceDesc}`))
          }
        } else if (options.data && !isForm(artifact)) {
          // Non-form artifact with data provided
          console.error(kleur.yellow(`Warning: --data option is only supported for form artifacts. Ignoring data.`))
          content = await renderLayer(layers, layerKey, { resolver })
        } else {
          // No data provided - output raw layer content
          content = await renderLayer(layers, layerKey, { resolver })
        }

        const outputStorage = new LocalFileSystem()

        if (options.out) {
          if (typeof content === 'string') {
            await outputStorage.writeFile(options.out, content)
          } else {
            await outputStorage.writeFile(options.out, Buffer.from(content))
          }

          if (format === 'pretty') {
            console.log(kleur.green(`✓ Layer rendered to ${options.out}`))
            console.log(`  Artifact: ${artifact.name}`)
            console.log(`  Layer: ${layerKey}`)
            console.log(`  Type: ${layer.mimeType}`)
          } else {
            console.log(JSON.stringify({
              success: true,
              output: options.out,
              artifact: artifact.name,
              layer: layerKey,
              mimeType: layer.mimeType,
            }, null, 2))
          }
        } else {
          // Output to stdout
          if (typeof content === 'string') {
            process.stdout.write(content)
          } else {
            process.stdout.write(Buffer.from(content))
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(kleur.red(`Error: ${message}`))
        process.exit(1)
      }
    })

  return render
}

function normalizeFormatOption(value: string): OutputFormat {
  const normalized = value.toLowerCase() as OutputFormat
  if (normalized !== 'json' && normalized !== 'pretty') {
    throw new Error(`Unknown format "${value}". Use "pretty" or "json".`)
  }
  return normalized
}

function printIssues(issues: Array<{ message: string; path?: string[] | undefined }>): void {
  console.error(kleur.red('Validation failed:'))
  for (const issue of issues) {
    const location = issue.path?.length ? issue.path.join('.') : 'root'
    console.error(`  - ${location}: ${issue.message}`)
  }
}

interface DryRunSummaryInput {
  artifact: Artifact
  layerKey: string
  layer: Layer
  sourcePath?: string
  format: OutputFormat
}

function printDryRunSummary(input: DryRunSummaryInput): void {
  const summary = {
    mode: 'dry-run',
    artifact: {
      name: input.artifact.name,
      kind: input.artifact.kind,
      version: input.artifact.version,
    },
    layer: {
      key: input.layerKey,
      kind: input.layer.kind,
      mimeType: input.layer.mimeType,
    },
    source: input.sourcePath ?? 'stdin',
  }

  if (input.format === 'json') {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    console.log(kleur.cyan('Dry run summary:'))
    console.log(`  Artifact:   ${summary.artifact.name} (${summary.artifact.kind})`)
    console.log(`  Version:    ${summary.artifact.version ?? 'N/A'}`)
    console.log(`  Layer:      ${summary.layer.key}`)
    console.log(`  Layer kind: ${summary.layer.kind}`)
    console.log(`  MIME type:  ${summary.layer.mimeType}`)
    console.log(`  Source:     ${summary.source}`)
  }
}
