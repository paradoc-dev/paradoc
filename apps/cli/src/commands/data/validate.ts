import { Command } from 'commander'
import kleur from 'kleur'
import { parse, validate as validateArtifact, isForm, type Form } from '@paradoc/core'

import { readTextInput, resolveArtifactTarget } from '../../utils/io.js'
import { parseDataInput, normalizeFormData } from '../../utils/data-input.js'
import { validateInstanceData, type InstanceData } from '../../utils/validate-data.js'

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
        const formParsed = parse(formRaw)

        // Validate form artifact
        const formValidation = validateArtifact(formParsed)
        if (formValidation.issues) {
          const issues = formValidation.issues.map((issue) => ({
            message: issue.message,
            path: issue.path?.map((segment) => String(segment)),
          }))

          if (!options.silent) {
            console.error(kleur.red('Form validation failed:'))
            for (const issue of issues) {
              const location = issue.path?.length ? issue.path.join('.') : 'root'
              console.error(`  - ${location}: ${issue.message}`)
            }
          }
          process.exit(1)
          return
        }

        // Check artifact kind is 'form'
        if (!isForm(formValidation.value)) {
          const artifact = formValidation.value as { kind?: string }
          const kind = artifact?.kind ?? 'unknown'
          if (!options.silent) {
            console.error(kleur.red(`Error: Expected form artifact, but received kind "${kind}".`))
          }
          process.exit(1)
          return
        }

        const form = formValidation.value as Form

        // Parse data from file, stdin, or inline JSON
        const { data: rawData, source: dataSource } = await parseDataInput(dataTarget)

        // Normalize to ensure { fields: {...} } structure
        const normalizedData = normalizeFormData(rawData)
        const instanceData: InstanceData = {
          fields: normalizedData.fields,
          annexes: normalizedData.annexes,
        }

        const result = validateInstanceData(form, instanceData)

        // Build data source description for output
        const dataSourceDesc = dataSource === 'stdin' ? 'stdin' : dataSource === 'inline' ? 'inline JSON' : dataTarget

        // Output result
        if (options.json) {
          const output = {
            success: result.success,
            form: formTarget,
            dataSource: dataSourceDesc,
            ...(result.success ? { data: result.data } : { errors: result.errors }),
          }
          console.log(JSON.stringify(output, null, 2))
        } else if (!options.silent) {
          if (result.success) {
            console.log(kleur.green('✓ Instance data is valid'))
            console.log(`  Form: ${formTarget}`)
            console.log(`  Data: ${dataSourceDesc}`)
          } else {
            console.error(kleur.red('Validation failed:'))
            for (const error of result.errors) {
              const location = error.field || 'root'
              console.error(`  - ${location}: ${error.message}`)
              if (error.value !== undefined) {
                console.error(kleur.gray(`    Value: ${JSON.stringify(error.value)}`))
              }
            }
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
