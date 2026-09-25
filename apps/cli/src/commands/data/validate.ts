import { Command } from 'commander'
import kleur from 'kleur'
import { isForm, type Form } from '@paradoc/core'

import { readTextInput, resolveArtifactTarget } from '../../utils/io.js'
import { parseDataInput, toFormPayload } from '../../utils/data-input.js'
import { printPayloadErrors, validateFormPayload } from '../../utils/validate-data.js'
import { loadValidatedArtifact } from '../../utils/artifact-file.js'

interface ValidateDataOptions {
  json?: boolean
  silent?: boolean
}

/**
 * Create the 'validate' command for validating instance data against a form
 */
export function createValidateCommand(): Command {
  const validate = new Command('validate')

  validate
    .argument('<form-file>', 'Form artifact file (JSON/YAML)')
    .argument('<data>', 'Instance data: file path, "-" for stdin, or inline JSON')
    .description('Validate instance data against a form artifact')
    .option('--json', 'Output machine-readable JSON result')
    .option('--silent', 'Suppress console output (exit code only)')
    .action(async (formTarget: string, dataTarget: string, options: ValidateDataOptions) => {
      try {
        // Form file is required (no stdin for form)
        if (!formTarget || formTarget === '-') {
          throw new Error('Form file path required. Use stdin only for data input.')
        }

        // Read form file
        const resolvedFormTarget = await resolveArtifactTarget(formTarget)
        const { raw: formRaw } = await readTextInput(resolvedFormTarget)
        const artifact = loadValidatedArtifact(formRaw)

        // Check artifact kind is 'form'
        if (!isForm(artifact)) {
          const kind = artifact.kind
          if (!options.silent) {
            console.error(kleur.red(`Error: Expected form artifact, but received kind "${kind}".`))
          }
          process.exit(1)
          return
        }

        const form = artifact as Form

        // Parse data from file, stdin, or inline JSON
        const { data: rawData, source: dataSource } = await parseDataInput(dataTarget)

        const result = validateFormPayload(form, toFormPayload(rawData))

        // Build data source description for output
        const dataSourceDesc = dataSource === 'stdin' ? 'stdin' : dataSource === 'inline' ? 'inline JSON' : dataTarget

        // Output result
        if (options.json) {
          const output = {
            success: result.success,
            form: formTarget,
            dataSource: dataSourceDesc,
            ...(result.success
              ? { data: result.data }
              : { errors: result.errors, ...(result.ruleErrors.length > 0 && { ruleErrors: result.ruleErrors }) }),
          }
          console.log(JSON.stringify(output, null, 2))
        } else if (!options.silent) {
          if (result.success) {
            console.log(kleur.green('✓ Instance data is valid'))
            console.log(`  Form: ${formTarget}`)
            console.log(`  Data: ${dataSourceDesc}`)
          } else {
            console.error(kleur.red('Validation failed:'))
            printPayloadErrors(result.errors, result.ruleErrors)
          }
        }

        process.exit(result.success ? 0 : 1)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!options.silent) {
          console.error(kleur.red(`Error: ${message}`))
        }
        process.exit(1)
      }
    })

  return validate
}
