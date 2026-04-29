import { Command } from 'commander'
import kleur from 'kleur'
import { rendererManager } from '../utils/renderer-manager.js'
import { LocalFileSystem } from '../utils/local-fs.js'
import { formatTable } from '../utils/table.js'

import { readBinaryInput } from '../utils/io.js'

/** PDF field info shape returned by inspectAcroFormFields */
interface PdfFieldInfo {
  name: string
  type: string
  required: boolean
  value: string | boolean | string[] | null | undefined
  page?: number
  rect?: [number, number, number, number]
  maxLen?: number | null
}

interface InspectOptions {
  format?: 'table' | 'json'
  filter?: string
  summary?: boolean
  includeButtons?: boolean
  includeSignatures?: boolean
  out?: string
}

export function createInspectCommand(): Command {
  const inspect = new Command('inspect')

  inspect
    .argument('<pdf>', 'PDF template file (path or "-" for stdin)')
    .description('Inspect PDF form fields to aid in bindings configuration')
    .option('--format <format>', 'Output format: table|json', 'table')
    .option('--filter <pattern>', 'Filter field names by glob (e.g. "party_*")')
    .option('--summary', 'Show totals only (no field listing)')
    .option('--include-buttons', 'Include button fields in the output')
    .option('--include-signatures', 'Include signature fields in the output')
    .option('--out <file>', 'Write inspection result to JSON file')
    .action(async (pdfTarget: string, options: InspectOptions) => {
      try {
        const storage = new LocalFileSystem()

        const format = normalizeFormatOption(options.format ?? 'table')
        const { data, sourcePath } = await readBinaryInput(pdfTarget)

        // Dynamically load the PDF renderer for inspectAcroFormFields
        const mod = await rendererManager.loadModule('@paradoc/renderer-pdf')
        const inspectAcroFormFields = mod.inspectAcroFormFields as (
          data: Uint8Array,
          options?: { includeButton?: boolean; includeSignature?: boolean }
        ) => Promise<PdfFieldInfo[]>

        const fields = await inspectAcroFormFields(data, {
          includeButton: Boolean(options.includeButtons),
          includeSignature: Boolean(options.includeSignatures),
        })

        const filtered = applyFilter(fields, options.filter)

        if (options.out) {
          const outputPath = options.out
          await storage.writeFile(outputPath, JSON.stringify(filtered, null, 2))
        }

        if (options.summary) {
          printSummary(filtered, sourcePath)
          return
        }

        if (format === 'json') {
          console.log(JSON.stringify(filtered, null, 2))
        } else {
          printTable(filtered, sourcePath)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(kleur.red(`Error: ${message}`))
        process.exit(1)
      }
    })

  return inspect
}

function normalizeFormatOption(value: string): InspectOptions['format'] {
  const normalized = value.toLowerCase()
  if (normalized !== 'table' && normalized !== 'json') {
    throw new Error(`Unknown format "${value}". Use "table" or "json".`)
  }
  return normalized as InspectOptions['format']
}

function applyFilter(fields: PdfFieldInfo[], pattern?: string): PdfFieldInfo[] {
  if (!pattern) return fields

  const regex = globToRegex(pattern)
  return fields.filter((field) => regex.test(field.name))
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[-[\]/{}()+?.\\^$|]/g, '\\$&')
  const regexPattern = `^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`
  return new RegExp(regexPattern, 'i')
}

function printTable(fields: PdfFieldInfo[], sourcePath?: string): void {
  if (fields.length === 0) {
    console.log(kleur.yellow('No matching fields found.'))
    return
  }

  const rows = fields.map((field) => [
    field.name,
    field.type,
    field.required ? 'yes' : 'no',
    formatFieldValue(field.value),
  ])

  console.log(kleur.cyan(`Fields from ${sourcePath ?? 'stdin'}:`))
  console.log(formatTable(['Name', 'Type', 'Required', 'Value'], rows))
}

function printSummary(fields: PdfFieldInfo[], sourcePath?: string): void {
  const totals = fields.reduce<Record<string, number>>((acc, field) => {
    acc[field.type] = (acc[field.type] ?? 0) + 1
    return acc
  }, {})

  const summary = {
    source: sourcePath ?? 'stdin',
    total: fields.length,
    breakdown: totals,
  }

  console.log(JSON.stringify(summary, null, 2))
}

function formatFieldValue(value: PdfFieldInfo['value']): string {
  if (value === undefined || value === null) return ''
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}
