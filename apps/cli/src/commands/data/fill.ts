import { Command } from 'commander'
import kleur from 'kleur'
import prompts from 'prompts'
import { toYAML, isForm, createSafeRegex, type Form, type FormField } from '@paradoc/core'
import { LocalFileSystem } from '../../utils/local-fs.js'

import { readTextInput, resolveArtifactTarget } from '../../utils/io.js'
import { parseDataInput, toFormPayload } from '../../utils/data-input.js'
import { makeInstanceTemplate } from '../../utils/instance-template.js'
import {
  printPayloadErrors,
  validateFormPayload,
  type FilledPayload,
} from '../../utils/validate-data.js'
import { loadValidatedArtifact, outputFormatOf } from '../../utils/artifact-file.js'

interface FillOptions {
  out: string
  data?: string
  json?: boolean
  yaml?: boolean
}

/**
 * Prompt user for a field value based on field type
 */
async function promptForField(
  fieldId: string,
  field: FormField,
  defaultValue: unknown,
  prefix = ''
): Promise<unknown> {
  const label = field.label || fieldId
  const description = field.description
  const isRequired = field.required === true

  // Build message with description if available
  let message = prefix ? `${prefix} ${label}` : label
  if (description) {
    message += kleur.gray(`\n  ${description}`)
  }

  // Handle enum fields with list selection
  if (field.type === 'enum') {
    const choices = field.enum.map((option) => ({
      value: String(option.value),
      title: option.label ?? String(option.value),
    }))
    const defaultVal = defaultValue !== undefined ? String(defaultValue) : choices[0]?.value
    const initialIndex = choices.findIndex((c: { value: string; title: string }) => c.value === defaultVal)

    const { value: selectedValue } = await prompts({
      type: 'select',
      name: 'value',
      message,
      choices,
      initial: initialIndex >= 0 ? initialIndex : 0,
    })
    if (selectedValue === undefined) throw new Error('User force closed the prompt')

    // Convert back to original type (string or number)
    const originalOption = field.enum.find((option) => String(option.value) === selectedValue)
    return originalOption !== undefined ? originalOption.value : selectedValue
  }

  // Handle boolean fields
  if (field.type === 'boolean') {
    const { value } = await prompts({
      type: 'confirm',
      name: 'value',
      message,
      initial: defaultValue !== undefined ? Boolean(defaultValue) : true,
    })
    if (value === undefined) throw new Error('User force closed the prompt')
    return value
  }

  // Handle number fields
  if (field.type === 'number') {
    const { value } = await prompts({
      type: 'number',
      name: 'value',
      message,
      initial: defaultValue !== undefined ? Number(defaultValue) : undefined,
      validate: (val: number | undefined) => {
        if (isRequired && (val === null || val === undefined)) {
          return 'This field is required'
        }
        if (val !== undefined && field.min !== undefined && val < field.min) {
          return `Must be at least ${field.min}`
        }
        if (val !== undefined && field.max !== undefined && val > field.max) {
          return `Must be at most ${field.max}`
        }
        return true
      },
    })
    if (value === undefined) throw new Error('User force closed the prompt')
    return value
  }

  // Handle fieldset fields (recursive)
  if (field.type === 'fieldset') {
    const nestedFields: Record<string, unknown> = {}
    if (field.fields) {
      const defaultValues =
        defaultValue && typeof defaultValue === 'object' && !Array.isArray(defaultValue)
          ? (defaultValue as Record<string, unknown>)
          : {}

      for (const [nestedFieldId, nestedField] of Object.entries(field.fields)) {
        const nestedDefault = defaultValues[nestedFieldId]
        nestedFields[nestedFieldId] = await promptForField(
          nestedFieldId,
          nestedField,
          nestedDefault,
          `${prefix}${label} >`
        )
      }
    }
    return nestedFields
  }

  // Handle string fields (text, email, uri, uuid, etc.)
  // For complex types, we'll prompt as JSON strings and parse them
  const isComplexType = ['coordinate', 'bbox', 'money', 'address', 'phone', 'duration'].includes(
    field.type
  )

  if (isComplexType) {
    const defaultStr = defaultValue !== undefined ? JSON.stringify(defaultValue, null, 2) : ''
    const { value } = await prompts({
      type: 'text',
      name: 'value',
      message: `${message}\n  ${kleur.gray('Enter as JSON (or leave empty for default)')}`,
      initial: defaultStr,
      validate: (val: string) => {
        if (!val.trim() && isRequired) {
          return 'This field is required'
        }
        if (val.trim()) {
          try {
            JSON.parse(val)
          } catch {
            return 'Invalid JSON format'
          }
        }
        return true
      },
    })
    if (value === undefined) throw new Error('User force closed the prompt')

    if (!value.trim()) {
      return defaultValue
    }

    try {
      return JSON.parse(value)
    } catch {
      return defaultValue
    }
  }

  // Handle simple string fields
  const { value } = await prompts({
    type: 'text',
    name: 'value',
    message,
    initial: defaultValue !== undefined ? String(defaultValue) : '',
    validate: (val: string) => {
      if (isRequired && !val.trim()) {
        return 'This field is required'
      }
      if (
        'minLength' in field &&
        field.minLength !== undefined &&
        val.length < field.minLength
      ) {
        return `Must be at least ${field.minLength} characters`
      }
      if (
        'maxLength' in field &&
        field.maxLength !== undefined &&
        val.length > field.maxLength
      ) {
        return `Must be at most ${field.maxLength} characters`
      }
      if ('pattern' in field && field.pattern && val) {
        try {
          const regex = createSafeRegex(field.pattern)
          if (!regex.test(val)) {
            return 'Does not match required pattern'
          }
        } catch {
          return 'Field has an unsafe or invalid pattern'
        }
      }
      return true
    },
  })
  if (value === undefined) throw new Error('User force closed the prompt')

  return value.trim() || (defaultValue !== undefined ? defaultValue : '')
}

/**
 * Create the 'fill' command for interactively filling form data
 */
export function createFillCommand(): Command {
  const fill = new Command('fill')

  fill
    .argument('<file>', 'Form artifact file (JSON/YAML)')
    .description('Fill form data interactively or from a data payload')
    .requiredOption('--out <file>', 'Output file path (format detected from extension)')
    .option('--data <pathOrJson>', 'Data payload: file path, "-" for stdin, or inline JSON (non-interactive)')
    .option('--json', 'Force JSON output format')
    .option('--yaml', 'Force YAML output format')
    .action(async (fileTarget: string, options: FillOptions) => {
      try {
        const storage = new LocalFileSystem()

        // Reject stdin for form - only accept file paths
        if (!fileTarget || fileTarget === '-') {
          throw new Error('Form file path required. Use --data for data input via stdin.')
        }

        if (!options.out) {
          throw new Error('--out option is required')
        }

        // Read form file
        const resolvedTarget = await resolveArtifactTarget(fileTarget)
        const { raw, sourcePath: _sourcePath } = await readTextInput(resolvedTarget)
        const artifact = loadValidatedArtifact(raw)

        // Check artifact kind is 'form'
        if (!isForm(artifact)) {
          const kind = artifact.kind
          console.error(kleur.red(`Error: Expected form artifact, but received kind "${kind}".`))
          process.exit(1)
          return
        }

        const form = artifact as Form

        // Interactive mode prompts for fields only; a form without fields has nothing to prompt for.
        if (!options.data && (!form.fields || Object.keys(form.fields).length === 0)) {
          console.log(kleur.yellow('Form has no fields. Nothing to fill.'))
          process.exit(0)
          return
        }

        let data: FilledPayload

        // Non-interactive mode: use --data
        if (options.data) {
          const { data: rawData, source: dataSource } = await parseDataInput(options.data)
          const validationResult = validateFormPayload(form, toFormPayload(rawData))

          if (!validationResult.success) {
            console.error(kleur.red('Data validation failed:'))
            printPayloadErrors(validationResult.errors, validationResult.ruleErrors)
            process.exit(1)
            return
          }

          data = validationResult.data

          // Log source info for non-interactive mode
          const sourceDesc = dataSource === 'stdin' ? 'stdin' : dataSource === 'inline' ? 'inline JSON' : options.data
          console.log(kleur.gray(`Using data from ${sourceDesc}`))
        } else {
          // Interactive mode
          // Generate instance template to get defaults
          const template = makeInstanceTemplate(form)

          console.log()
          console.log(kleur.bold(`Fill Form: ${form.title || form.name}`))
          if (form.description) {
            console.log(kleur.gray(form.description))
          }
          console.log()

          // Prompt for each field
          const filledFields: Record<string, unknown> = {}
          for (const [fieldId, field] of Object.entries(form.fields ?? {})) {
            const defaultValue = template.fields[fieldId]
            filledFields[fieldId] = await promptForField(fieldId, field, defaultValue)
          }

          // Interactive mode collects field values only; annexes are attached separately.
          data = {
            fields: filledFields,
          }
        }

        // Determine output format
        const format = outputFormatOf({ ...options, filePath: options.out, fallback: 'yaml' })

        // Serialize data
        const serialized =
          format === 'json' ? JSON.stringify(data, null, 2) : toYAML(data)

        // Ensure trailing newline
        const content = serialized.endsWith('\n') ? serialized : serialized + '\n'

        // Write to output file
        await storage.writeFile(options.out, content)

        console.log()
        console.log(kleur.green(`✓ Form data saved`))
        console.log(`  Output: ${options.out}`)
        console.log(`  Format: ${format.toUpperCase()}`)
        console.log()
      } catch (error) {
        // Handle user cancellation (Ctrl+C)
        if (
          error instanceof Error &&
          (error.message?.includes('force closed') || error.message?.includes('User force closed'))
        ) {
          console.log()
          console.log(kleur.yellow('Cancelled.'))
          console.log()
          process.exit(0)
          return
        }

        const message = error instanceof Error ? error.message : String(error)
        console.error(kleur.red(`Error: ${message}`))
        process.exit(1)
      }
    })

  return fill
}
