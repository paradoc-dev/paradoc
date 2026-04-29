import { Command } from 'commander'
import kleur from 'kleur'
import { LocalFileSystem } from '../utils/local-fs.js'
import { resolveArtifactTarget } from '../utils/io.js'

import {
  findRepoRoot,
  parseAndValidateArtifact,
  detectFileDependencies,
  fileExists,
} from '../utils/project.js'

/**
 * Create the 'show' command
 * Display artifact content and metadata
 */
export function createShowCommand(): Command {
  const show = new Command('show')

  show
    .argument('<artifact>', 'Path to artifact file')
    .description('Show details about an artifact')
    .option('--raw', 'Show raw file content without parsing')
    .option('--deps', 'Show file dependencies')
    .action(async (artifactPath: string, options) => {
      try {
        // Find repo root or use current directory
        const repoRoot = (await findRepoRoot()) ?? process.cwd()
        const storage = new LocalFileSystem(repoRoot)

        // Resolve artifact reference or file path
        const resolvedTarget = await resolveArtifactTarget(artifactPath)
        const filePath = storage.getAbsolutePath(resolvedTarget)

        // Check file exists
        if (!(await fileExists(filePath))) {
          console.error(kleur.red(`File not found: ${artifactPath}`))
          process.exit(1)
        }

        // Read file content
        const content = await storage.readFile(filePath, 'utf-8')

        // Raw mode - just print content
        if (options.raw) {
          console.log(content)
          return
        }

        // Parse and validate artifact
        try {
          const artifact = await parseAndValidateArtifact(filePath)

          // Display artifact metadata
          console.log(kleur.bold('Artifact:') + ` ${artifact.name}`)
          console.log(kleur.gray('Kind:') + `     ${artifact.kind}`)

          // Version if present
          const meta = artifact as unknown as Record<string, unknown>
          if (typeof meta.version === 'string') {
            console.log(kleur.gray('Version:') + `  ${meta.version}`)
          }

          // Title if present
          if (artifact.title) {
            console.log(kleur.gray('Title:') + `    ${artifact.title}`)
          }

          // Description if present
          if (artifact.description) {
            console.log(kleur.gray('Description:'))
            console.log(`  ${artifact.description}`)
          }

          // ContentRef fields (instructions, agentInstructions)
          const artifactRecord = artifact as unknown as Record<string, unknown>
          const contentRefFields = [
            { key: 'instructions', label: 'Instructions' },
            { key: 'agentInstructions', label: 'Agent instructions' },
          ] as const
          for (const { key, label } of contentRefFields) {
            const ref = artifactRecord[key] as { kind: string; text?: string; path?: string; mimeType?: string; checksum?: string } | undefined
            if (!ref) continue
            if (ref.kind === 'inline') {
              const preview = ref.text && ref.text.length > 60 ? ref.text.slice(0, 60) + '...' : ref.text
              console.log(kleur.gray(`${label}:`) + ` ${kleur.dim('[inline]')} ${preview}`)
            } else if (ref.kind === 'file') {
              const checkInfo = ref.checksum ? kleur.green('checksum') : kleur.yellow('no checksum')
              console.log(kleur.gray(`${label}:`) + ` ${ref.path} ${kleur.dim(`[${ref.mimeType ?? 'unknown'}, ${checkInfo}]`)}`)
            }
          }

          console.log()

          // File dependencies
          if (options.deps) {
            const deps = detectFileDependencies(artifact)
            if (deps.length > 0) {
              console.log(kleur.bold('File dependencies:'))
              for (const dep of deps) {
                const depPath = storage.joinPath(storage.dirname(filePath), dep)
                const exists = await fileExists(depPath)
                const status = exists ? kleur.green('✓') : kleur.red('✗')
                console.log(`  ${status} ${dep}`)
              }
              console.log()
            } else {
              console.log(kleur.gray('No file dependencies'))
              console.log()
            }
          }

          // Show fields for forms
          if (artifact.kind === 'form' && artifact.fields) {
            console.log(kleur.bold('Fields:'))
            for (const [fieldName, field] of Object.entries(artifact.fields)) {
              const required = (field as { required?: boolean }).required ? kleur.red('*') : ' '
              const fieldType = (field as { type: string }).type
              console.log(`  ${required} ${fieldName} (${fieldType})`)
            }
            console.log()
          }

          // Show layers if present
          if ('layers' in artifact && artifact.layers) {
            const layers = artifact.layers as Record<string, unknown>
            const layerNames = Object.keys(layers)
            if (layerNames.length > 0) {
              console.log(kleur.bold('Layers:'))
              for (const name of layerNames) {
                const layer = layers[name] as Record<string, unknown>
                const kind = typeof layer.kind === 'string' ? layer.kind : 'unknown'
                console.log(`  - ${name} (${kind})`)
              }
              console.log()
            }
          }

          // Show items for checklists
          if (artifact.kind === 'checklist' && artifact.items) {
            console.log(kleur.bold('Items:'))
            for (const item of artifact.items) {
              console.log(`  □ ${item.title}`)
            }
            console.log()
          }

          // Show contents for bundles
          if (artifact.kind === 'bundle' && artifact.contents) {
            console.log(kleur.bold('Contents:'))
            for (const item of artifact.contents) {
              if (item.type === 'path') {
                console.log(`  - ${item.key}: ${item.path}`)
              } else if (item.type === 'registry') {
                console.log(`  - ${item.key}: ${item.slug} (registry)`)
              } else if (item.type === 'inline') {
                const inlineKind = item.artifact?.kind ?? 'unknown'
                console.log(`  - ${item.key}: (inline ${inlineKind})`)
              }
            }
            console.log()
          }

          console.log(kleur.gray(`File: ${artifactPath}`))
        } catch (parseError) {
          // Not a valid artifact - show as raw content
          console.log(kleur.yellow('Warning: Could not parse as artifact'))
          console.log(kleur.gray(`Error: ${parseError instanceof Error ? parseError.message : String(parseError)}`))
          console.log()
          console.log(kleur.bold('Content:'))
          console.log('---')
          console.log(content)
          console.log('---')
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(kleur.red(`Error: ${message}`))
        process.exit(1)
      }
    })

  return show
}
