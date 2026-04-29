import { Command } from 'commander'
import kleur from 'kleur'
import { parse, validate, toYAML, isForm, type Form } from '@paradoc/core'
import { LocalFileSystem } from '../../utils/local-fs.js'

import { readTextInput, resolveArtifactTarget } from '../../utils/io.js'
import { makeInstanceTemplate } from '../../utils/instance-template.js'

interface TemplateOptions {
  out?: string
  json?: boolean
  yaml?: boolean
  silent?: boolean
}

/**
 * Determine output format based on options and file extension
 */
function determineOutputFormat(
  options: TemplateOptions,
  storage: LocalFileSystem
): 'json' | 'yaml' {
  // Check explicit flags first
  if (options.json) {
    return 'json'
  }
  if (options.yaml) {
    return 'yaml'
  }

  // Check file extension if --out is specified
  if (options.out) {
    const ext = storage.extname(options.out).toLowerCase()
    if (ext === '.json') {
      return 'json'
    }
    if (ext === '.yaml' || ext === '.yml') {
      return 'yaml'
    }
  }

  // Default to YAML
  return 'yaml'
}

/**
 * Create the 'template' command for generating data templates
 */
export function createTemplateCommand(): Command {
  const template = new Command('template')

  template
    .argument('<file>', 'Form artifact file (JSON/YAML)')
    .description('Generate an instance template from a form artifact')
    .option('--out <file>', 'Output file path (format detected from extension)')
    .option('--json', 'Force JSON output format')
    .option('--yaml', 'Force YAML output format')
    .option('--silent', 'Suppress console output (exit code only)')
    .action(async (fileTarget: string, options: TemplateOptions) => {
      try {
        const storage = new LocalFileSystem()

        // Reject stdin - only accept file paths
        if (!fileTarget || fileTarget === '-') {
          throw new Error('File path required. This command does not accept stdin input.')
        }

        // Read file
        const resolvedTarget = await resolveArtifactTarget(fileTarget)
        const { raw } = await readTextInput(resolvedTarget)
        const parsed = parse(raw)

        // Validate artifact
        const validation = validate(parsed)
        if (validation.issues) {
          const issues = validation.issues.map((issue) => ({
            message: issue.message,
            path: issue.path?.map((segment) => String(segment)),
          }))

          if (!options.silent) {
            console.error(kleur.red('Validation failed:'))
            for (const issue of issues) {
              const location = issue.path?.length ? issue.path.join('.') : 'root'
              console.error(`  - ${location}: ${issue.message}`)
            }
          }
          process.exit(1)
          return
        }

        // Check artifact kind is 'form'
        if (!isForm(validation.value)) {
          const artifact = validation.value as { kind?: string }
          const kind = artifact?.kind ?? 'unknown'
          if (!options.silent) {
            console.error(kleur.red(`Error: Expected form artifact, but received kind "${kind}".`))
          }
          process.exit(1)
          return
        }

        const form = validation.value as Form

        // Check if form has fields or annexes
        const hasFields = form.fields && Object.keys(form.fields).length > 0
        const hasAnnexes = form.annexes && Object.keys(form.annexes).length > 0

        if (!hasFields && !hasAnnexes) {
          if (!options.silent) {
            console.log(kleur.yellow('Form has no fields or annexes. Nothing to generate.'))
          }
          process.exit(0)
          return
        }

        // Generate instance template
        const instanceTemplate = makeInstanceTemplate(form)

        // Determine output format
        const format = determineOutputFormat(options, storage)

        // Serialize template
        const serialized =
          format === 'json'
            ? JSON.stringify(instanceTemplate, null, 2)
            : toYAML(instanceTemplate)

        // Ensure trailing newline
        const content = serialized.endsWith('\n') ? serialized : serialized + '\n'

        // Output to file or stdout
        if (options.out) {
          // Write to file
          await storage.writeFile(options.out, content)
          if (!options.silent) {
            console.log(kleur.green(`✓ Instance template generated`))
            console.log(`  Format: ${format.toUpperCase()}`)
            console.log(`  Output: ${options.out}`)
            console.log(`  Source: ${fileTarget}`)
          }
        } else {
          // Write to stdout
          process.stdout.write(content)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!options.silent) {
          console.error(kleur.red(`Error: ${message}`))
        }
        process.exit(1)
      }
    })

  return template
}
