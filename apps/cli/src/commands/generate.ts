import { Command } from 'commander'
import kleur from 'kleur'
import YAML from 'yaml'
import { jsonToDts, jsonToTsModule } from '@paradoc/core'
import { LocalFileSystem } from '../utils/local-fs.js'

import type { ArtifactKind } from '../types.js'

type GenerateOutputFormat = 'typed' | 'ts'

interface GenerateOptions {
  output?: GenerateOutputFormat
}

/**
 * Create the 'generate' command
 * Generates TypeScript types for existing artifact files
 */
export function createGenerateCommand(): Command {
  const generate = new Command('generate')

  generate
    .argument('<file>', 'Path to artifact file (JSON or YAML)')
    .description('Generate TypeScript types for an artifact file')
    .option('--output <output>', 'Output format: typed (.d.ts) or ts (TypeScript module)', 'typed')
    .action(async (file: string, options: GenerateOptions) => {
      try {
        const storage = new LocalFileSystem()

        // 1. Read and parse the artifact file
        const ext = storage.extname(file).toLowerCase()
        let content: string
        let artifact: Record<string, unknown>

        try {
          content = await storage.readFile(file, 'utf-8')
        } catch (error) {
          console.error(kleur.red(`Could not read file: ${file}`))
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            console.error(kleur.gray('File does not exist'))
          }
          process.exit(1)
        }

        try {
          if (ext === '.json') {
            artifact = JSON.parse(content)
          } else if (ext === '.yaml' || ext === '.yml') {
            artifact = YAML.parse(content) as Record<string, unknown>
          } else {
            console.error(kleur.red(`Unsupported file extension: ${ext}`))
            console.error(kleur.gray('Supported extensions: .json, .yaml, .yml'))
            process.exit(1)
          }
        } catch (error) {
          console.error(kleur.red(`Could not parse file: ${file}`))
          console.error(kleur.gray(error instanceof Error ? error.message : String(error)))
          process.exit(1)
        }

        // 2. Validate it looks like an artifact
        if (!artifact.kind || typeof artifact.kind !== 'string') {
          console.error(kleur.red('File does not appear to be a valid artifact'))
          console.error(kleur.gray('Missing or invalid "kind" field'))
          process.exit(1)
        }

        const validKinds = ['form', 'document', 'checklist', 'bundle']
        if (!validKinds.includes(artifact.kind)) {
          console.error(kleur.red(`Invalid artifact kind: ${artifact.kind}`))
          console.error(kleur.gray(`Expected one of: ${validKinds.join(', ')}`))
          process.exit(1)
        }

        const artifactKind = artifact.kind as ArtifactKind
        const _artifactName = (artifact.name as string) || storage.basename(file).replace(ext, '')

        // 3. Determine output format
        const format = options.output || 'typed'
        if (format !== 'typed' && format !== 'ts') {
          console.error(kleur.red(`Invalid output format: ${format}`))
          console.error(kleur.gray('Expected: typed or ts'))
          process.exit(1)
        }

        // 4. Generate and write output file(s)
        const dir = storage.dirname(file)
        const baseFileName = storage.basename(file).replace(ext, '')

        if (format === 'ts') {
          // Generate TypeScript module with embedded schema
          // We embed inline with `as const` to preserve literal types
          // (importing from JSON with resolveJsonModule loses literal types)
          const tsFileName = `${baseFileName}.ts`
          const tsPath = storage.joinPath(dir, tsFileName)

          const tsContent = jsonToTsModule(artifact, {
            artifactKind,
            exportName: toCamelCase(baseFileName),
            // No jsonImportPath - embed inline for type safety
          })

          await storage.writeFile(tsPath, tsContent)
          console.log(kleur.green('✓') + ` Generated: ${tsPath}`)
        } else {
          // Generate .d.ts file
          // First, ensure we have a JSON file (convert YAML if needed)
          let jsonFileName: string
          let jsonPath: string

          if (ext === '.json') {
            jsonFileName = storage.basename(file)
            jsonPath = file
          } else {
            // Convert YAML to JSON
            jsonFileName = `${baseFileName}.json`
            jsonPath = storage.joinPath(dir, jsonFileName)
            await storage.writeFile(jsonPath, JSON.stringify(artifact, null, 2))
            console.log(kleur.green('✓') + ` Generated: ${jsonPath}`)
          }

          // Generate .d.ts
          const dtsFileName = `${jsonFileName}.d.ts`
          const dtsPath = storage.joinPath(dir, dtsFileName)
          const dtsContent = jsonToDts(artifact, jsonFileName)
          await storage.writeFile(dtsPath, dtsContent)
          console.log(kleur.green('✓') + ` Generated: ${dtsPath}`)
        }

        console.log()
        console.log(kleur.gray('You can now import the artifact with full type safety:'))
        if (format === 'ts') {
          console.log(kleur.cyan(`  import { ${toCamelCase(baseFileName)} } from './${baseFileName}.js'`))
        } else {
          console.log(kleur.cyan(`  import schema from './${baseFileName}.json'`))
          console.log(kleur.cyan(`  import { para } from '@paradoc/sdk'`))
          console.log(kleur.cyan(`  const ${toCamelCase(baseFileName)} = para.${artifactKind}(schema)`))
        }
      } catch (error) {
        console.error(kleur.red('Failed to generate types'))
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  return generate
}

/**
 * Convert kebab-case to camelCase for export names
 * @example "w9-form" -> "w9Form"
 */
function toCamelCase(str: string): string {
  return str.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase())
}
