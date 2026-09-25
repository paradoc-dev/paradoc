import { Command } from 'commander'
import kleur from 'kleur'
import { isDeepStrictEqual } from 'node:util'
import YAML from 'yaml'
import { LocalFileSystem } from '../utils/local-fs.js'
import { loadValidatedArtifact } from '../utils/artifact-file.js'
import { writeTypedOutput, type TypedOutputFormat } from '../utils/typed-output.js'

interface GenerateOptions {
  output?: TypedOutputFormat
  force?: boolean
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
    .option('--force', 'Overwrite a differing generated JSON file')
    .action(async (file: string, options: GenerateOptions) => {
      try {
        const storage = new LocalFileSystem()

        // 1. Read and parse the artifact file
        const sourceExt = storage.extname(file)
        const ext = sourceExt.toLowerCase()
        let content: string
        let artifact

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
          if (ext !== '.json' && ext !== '.yaml' && ext !== '.yml') {
            console.error(kleur.red(`Unsupported file extension: ${ext}`))
            console.error(kleur.gray('Supported extensions: .json, .yaml, .yml'))
            process.exit(1)
          }
          let candidate: Record<string, unknown>
          try {
            candidate = (ext === '.json' ? JSON.parse(content) : YAML.parse(content)) as Record<string, unknown>
          } catch (error) {
            console.error(kleur.red(`Could not parse file: ${file}`))
            console.error(kleur.gray(error instanceof Error ? error.message : String(error)))
            process.exit(1)
          }
          if (!candidate.kind || typeof candidate.kind !== 'string') {
            console.error(kleur.red('File does not appear to be a valid artifact'))
            console.error(kleur.gray('Missing or invalid "kind" field'))
            process.exit(1)
          }
          const validKinds = ['form', 'document', 'checklist', 'bundle']
          if (!validKinds.includes(candidate.kind)) {
            console.error(kleur.red(`Invalid artifact kind: ${candidate.kind}`))
            console.error(kleur.gray(`Expected one of: ${validKinds.join(', ')}`))
            process.exit(1)
          }
          artifact = loadValidatedArtifact(content)
        } catch (error) {
          console.error(kleur.red(`Could not load valid artifact: ${file}`))
          console.error(kleur.gray(error instanceof Error ? error.message : String(error)))
          process.exit(1)
        }

        // 3. Determine output format
        const format = options.output || 'typed'
        if (format !== 'typed' && format !== 'ts') {
          console.error(kleur.red(`Invalid output format: ${format}`))
          console.error(kleur.gray('Expected: typed or ts'))
          process.exit(1)
        }

        // 4. Generate and write output file(s)
        const dir = storage.dirname(file)
        const baseFileName = storage.basename(file).slice(0, -sourceExt.length)

        if (format === 'ts') {
          // Generate TypeScript module with embedded schema
          // We embed inline with `as const` to preserve literal types
          // (importing from JSON with resolveJsonModule loses literal types)
          const tsFileName = `${baseFileName}.ts`
          const tsPath = storage.joinPath(dir, tsFileName)

          const result = await writeTypedOutput(storage, { artifact, format, primaryPath: tsPath })
          console.log(kleur.green('✓') + ` Generated: ${tsPath}`)
          console.log()
          console.log(kleur.gray('You can now import the artifact with full type safety:'))
          console.log(kleur.cyan(`  import { ${result.exportName} } from './${baseFileName}.js'`))
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
            if (await storage.exists(jsonPath) && !options.force) {
              let existing: unknown
              try { existing = JSON.parse(await storage.readFile(jsonPath, 'utf-8')) } catch { existing = undefined }
              if (!isDeepStrictEqual(existing, artifact)) {
                throw new Error(`${jsonPath} already exists with different content; pass --force to overwrite it`)
              }
            }
          }

          const result = await writeTypedOutput(storage, {
            artifact,
            format,
            primaryPath: jsonPath,
            sourceJsonPath: jsonPath,
            writeSourceJson: ext !== '.json',
          })
          for (const path of result.writtenPaths) console.log(kleur.green('✓') + ` Generated: ${path}`)
          console.log()
          console.log(kleur.gray('You can now import the artifact with full type safety:'))
          console.log(kleur.cyan(`  import schema from './${baseFileName}.json'`))
          console.log(kleur.cyan(`  import { p } from '@paradoc/sdk'`))
          console.log(kleur.cyan(`  const ${result.exportName} = p.${artifact.kind}(schema)`))
        }
      } catch (error) {
        console.error(kleur.red('Failed to generate types'))
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  return generate
}
