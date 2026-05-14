import { Command } from 'commander'
import kleur from 'kleur'
import prompts from 'prompts'
import { parse, validate, toYAML, type Artifact, type Layer } from '@paradoc/core'
import { LocalFileSystem } from '../utils/local-fs.js'

import { readTextInput, resolveArtifactTarget } from '../utils/io.js'
import { computeHash } from '../utils/hash.js'
import { getMimeType, isKnownMimeType } from '../utils/mime.js'
import { sanitizePath } from '../utils/security.js'

type AttachTarget = 'layer' | 'instructions' | 'agent-instructions'

interface AttachOptions {
  yes?: boolean
  name?: string
  title?: string
  description?: string
  mimeType?: string
  dryRun?: boolean
  as?: AttachTarget
}

export function createAttachCommand(): Command {
  const attach = new Command('attach')

  attach
    .argument('<artifact>', 'Artifact file (JSON/YAML) to attach file to')
    .argument('<file>', 'File to attach (PDF, image, etc.)')
    .description('Attach a file as a layer to an artifact')
    .option('-y, --yes', 'Skip interactive prompts')
    .option('-n, --name <name>', 'Layer name (key in layers object)')
    .option('-t, --title <title>', 'Human-readable title for the layer')
    .option('-d, --description <desc>', 'Description of the layer')
    .option('-m, --mime-type <type>', 'Override auto-detected MIME type')
    .option('--dry-run', 'Show what would be changed without modifying the file')
    .option('--as <target>', 'Attach as: layer (default), instructions, or agent-instructions', 'layer')
    .action(async (artifactTarget: string, fileTarget: string, options: AttachOptions) => {
      try {
        const storage = new LocalFileSystem()

        // Read and parse the artifact
        const resolvedTarget = await resolveArtifactTarget(artifactTarget)
        const { raw, baseDir, sourcePath } = await readTextInput(resolvedTarget)
        if (!sourcePath) {
          console.error(kleur.red('Cannot attach to artifact from stdin. Please specify a file path.'))
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

        // Validate file to attach exists
        const absoluteFilePath = storage.getAbsolutePath(fileTarget)
        try {
          await storage.stat(absoluteFilePath)
        } catch {
          console.error(kleur.red(`File not found: ${fileTarget}`))
          process.exit(1)
        }

        // Security: validate path is safe (no path traversal)
        const safePath = sanitizePath(baseDir, fileTarget)
        if (!safePath) {
          console.error(kleur.red('Invalid file path: path traversal not allowed'))
          process.exit(1)
        }

        // Compute relative path from artifact directory
        const relativePath = storage.relative(baseDir, absoluteFilePath)

        // Detect MIME type
        const ext = storage.extname(fileTarget)
        let mimeType = options.mimeType
        if (!mimeType) {
          mimeType = getMimeType(ext)
          if (!isKnownMimeType(ext)) {
            console.warn(kleur.yellow(`Unknown file extension "${ext}", using: ${mimeType}`))
          }
        }

        // Compute checksum
        const hashHex = await computeHash(absoluteFilePath)
        const checksum = `sha256:${hashHex}`

        // Validate --as target
        const target: AttachTarget = options.as ?? 'layer'
        const validTargets: AttachTarget[] = ['layer', 'instructions', 'agent-instructions']
        if (!validTargets.includes(target)) {
          console.error(kleur.red(`Invalid --as value: "${target}". Must be one of: ${validTargets.join(', ')}`))
          process.exit(1)
        }

        // ContentRef mode: attach as instructions or agentInstructions
        if (target === 'instructions' || target === 'agent-instructions') {
          const fieldName = target === 'instructions' ? 'instructions' : 'agentInstructions'
          const artifactRecord = artifact as unknown as Record<string, unknown>

          // Build the ContentRef
          const contentRef = {
            kind: 'file' as const,
            path: `./${relativePath}`,
            mimeType,
            checksum,
            ...(options.title && { title: options.title }),
            ...(options.description && { description: options.description }),
          }

          // Check if field already exists
          const existingRef = artifactRecord[fieldName]
          if (existingRef && !options.yes) {
            console.log()
            console.log(kleur.yellow(`"${fieldName}" already exists on this artifact.`))
            const { confirm } = await prompts({
              type: 'confirm',
              name: 'confirm',
              message: `Overwrite existing ${fieldName}?`,
              initial: false,
            })
            if (!confirm) {
              console.log(kleur.yellow('Cancelled.'))
              process.exit(0)
            }
          }

          // Show what will be set
          console.log()
          console.log(kleur.cyan(`Content reference to set:`))
          console.log(kleur.white(`  ${fieldName}:`))
          console.log(kleur.gray(`    kind: file`))
          console.log(kleur.gray(`    path: ${contentRef.path}`))
          console.log(kleur.gray(`    mimeType: ${contentRef.mimeType}`))
          console.log(kleur.gray(`    checksum: ${contentRef.checksum}`))
          if (contentRef.title) console.log(kleur.gray(`    title: ${contentRef.title}`))
          if (contentRef.description) console.log(kleur.gray(`    description: ${contentRef.description}`))
          console.log()

          if (options.dryRun) {
            console.log(kleur.yellow('Dry run: No changes written to file.'))
            process.exit(0)
          }

          // Set the field
          artifactRecord[fieldName] = contentRef

          // Write back to file
          const outputExt = storage.extname(sourcePath).toLowerCase()
          const isJson = outputExt === '.json'
          const content = isJson ? JSON.stringify(artifact, null, 2) : toYAML(artifact)
          await storage.writeFile(sourcePath, content)

          console.log(kleur.green(`Set "${fieldName}" on: ${artifactTarget}`))
          return
        }

        // Layer mode (default): attach as a layer
        // Determine layer name
        let layerName = options.name
        let layerTitle = options.title
        let layerDescription = options.description

        // Get existing layers
        const existingLayers = ('layers' in artifact && artifact.layers)
          ? Object.keys(artifact.layers as Record<string, Layer>)
          : []

        // Default layer name from filename (without extension)
        const baseName = storage.basename(fileTarget)
        const nameWithoutExt = ext ? baseName.slice(0, -ext.length) : baseName
        const defaultName = nameWithoutExt.toLowerCase().replace(/[^a-z0-9]/g, '-')

        if (!options.yes) {
          // Interactive mode
          console.log()
          console.log(kleur.bold('Attach File to Artifact'))
          console.log()
          console.log(kleur.gray('File:'), fileTarget)
          console.log(kleur.gray('MIME type:'), mimeType)
          console.log(kleur.gray('Checksum:'), checksum)
          console.log()

          if (existingLayers.length > 0) {
            console.log(kleur.gray('Existing layers:'), existingLayers.join(', '))
            console.log()
          }

          // Prompt for layer name
          const { name: inputName } = await prompts({
            type: 'text',
            name: 'name',
            message: 'Layer name:',
            initial: layerName || defaultName,
            validate: (val: string) => {
              if (!val.trim()) return 'Layer name is required'
              if (!/^[a-z0-9-]+$/.test(val)) return 'Layer name must be lowercase letters, numbers, and hyphens only'
              if (existingLayers.includes(val)) return `Layer "${val}" already exists`
              return true
            },
          })
          if (!inputName) {
            console.log(kleur.yellow('\nCancelled.'))
            process.exit(0)
          }
          layerName = inputName.trim()

          // Prompt for title
          const { title: inputTitle } = await prompts({
            type: 'text',
            name: 'title',
            message: 'Title (optional):',
            initial: layerTitle || '',
          })
          layerTitle = inputTitle?.trim() || undefined

          // Prompt for description
          const { description: inputDescription } = await prompts({
            type: 'text',
            name: 'description',
            message: 'Description (optional):',
            initial: layerDescription || '',
          })
          layerDescription = inputDescription?.trim() || undefined
        } else {
          // Non-interactive mode
          if (!layerName) {
            layerName = defaultName
          }

          // Check for duplicate
          if (existingLayers.includes(layerName)) {
            console.error(kleur.red(`Layer "${layerName}" already exists. Use --name to specify a different name.`))
            process.exit(1)
          }
        }

        // Build the new layer
        const newLayer: Layer = {
          kind: 'file',
          path: `./${relativePath}`,
          mimeType,
          checksum,
          ...(layerTitle && { title: layerTitle }),
          ...(layerDescription && { description: layerDescription }),
        }

        // Show what will be added
        console.log()
        console.log(kleur.cyan('Layer to add:'))
        console.log(kleur.white(`  layers.${layerName}:`))
        console.log(kleur.gray(`    kind: file`))
        console.log(kleur.gray(`    path: ${newLayer.path}`))
        console.log(kleur.gray(`    mimeType: ${newLayer.mimeType}`))
        console.log(kleur.gray(`    checksum: ${newLayer.checksum}`))
        if (newLayer.title) console.log(kleur.gray(`    title: ${newLayer.title}`))
        if (newLayer.description) console.log(kleur.gray(`    description: ${newLayer.description}`))
        console.log()

        if (options.dryRun) {
          console.log(kleur.yellow('Dry run: No changes written to file.'))
          process.exit(0)
        }

        // Add layer to artifact
        if (!('layers' in artifact) || !artifact.layers) {
          (artifact as unknown as Record<string, unknown>).layers = {}
        }
        const layers = (artifact as unknown as { layers: Record<string, Layer> }).layers
        layers[layerName!] = newLayer

        // Write back to file
        const outputExt = storage.extname(sourcePath).toLowerCase()
        const isJson = outputExt === '.json'
        const content = isJson ? JSON.stringify(artifact, null, 2) : toYAML(artifact)
        await storage.writeFile(sourcePath, content)

        console.log(kleur.green(`Attached "${layerName}" layer to: ${artifactTarget}`))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(kleur.red(`Error: ${message}`))
        process.exit(1)
      }
    })

  return attach
}
