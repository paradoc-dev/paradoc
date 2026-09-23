import { Command } from 'commander'
import kleur from 'kleur'
import { form as formApi, isForm, validate, type Form, type FormExtraction } from '@paradoc/core'
import { LocalFileSystem } from '../../utils/local-fs.js'
import { readTextInput, resolveArtifactTarget } from '../../utils/io.js'
import { parseArtifactFile } from '../../utils/artifact-file.js'

interface ExtractOptions {
  layer?: string
  out?: string
}

type FileResult =
  | ({ file: string } & FormExtraction)
  | { file: string; error: { code: string; message: string } }

function errorOf(error: unknown): { code: string; message: string } {
  const message = error instanceof Error ? error.message : String(error)
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : 'extract_error'
  return { code, message }
}

async function loadForm(target: string): Promise<Form> {
  const { raw } = await readTextInput(await resolveArtifactTarget(target))
  const validation = validate(parseArtifactFile(raw))
  if (validation.issues) {
    const detail = validation.issues
      .map((issue) => `  - ${issue.path?.length ? issue.path.map(String).join('.') : 'root'}: ${issue.message}`)
      .join('\n')
    throw new Error(`Form validation failed:\n${detail}`)
  }
  if (!isForm(validation.value)) {
    const kind = (validation.value as { kind?: string })?.kind ?? 'unknown'
    throw new Error(`Expected form artifact, but received kind "${kind}".`)
  }
  return validation.value as Form
}

/**
 * Create the 'extract' command: read filled PDF forms back into form data.
 */
export function createExtractCommand(): Command {
  const extract = new Command('extract')

  extract
    .argument('<form-file>', 'Form artifact file (JSON/YAML)')
    .argument('<pdf>', 'Filled PDF file, or a directory of filled PDFs')
    .description('Extract form data from filled PDF forms (AcroForm fields) as JSON')
    .option('--layer <key>', 'PDF layer to read against (required when the form has several)')
    .option('--out <file>', 'Write the JSON result to a file instead of stdout')
    .action(async (formTarget: string, pdfTarget: string, options: ExtractOptions) => {
      try {
        if (!formTarget || formTarget === '-') throw new Error('Form file path required.')
        const storage = new LocalFileSystem()
        const instance = formApi.from(await loadForm(formTarget))

        const pdfPath = storage.getAbsolutePath(pdfTarget)
        if (!(await storage.exists(pdfPath))) throw new Error(`File not found: ${pdfTarget}`)
        const isDirectory = (await storage.stat(pdfPath)).isDirectory

        const extractFile = async (file: string, label: string): Promise<FileResult> => {
          try {
            const pdf = new Uint8Array(await storage.readFile(file, 'binary'))
            return { file: label, ...(await instance.extract(pdf, { layer: options.layer })) }
          } catch (error) {
            return { file: label, error: errorOf(error) }
          }
        }

        let output: unknown
        let failed: boolean
        if (isDirectory) {
          const names = (await storage.listFiles(pdfPath)).filter((name) => name.toLowerCase().endsWith('.pdf')).sort()
          if (names.length === 0) throw new Error(`No PDF files found in ${pdfTarget}`)
          const results: FileResult[] = []
          for (const name of names) results.push(await extractFile(storage.joinPath(pdfPath, name), name))
          output = { results }
          failed = results.some((result) => 'error' in result)
        } else {
          const result = await extractFile(pdfPath, pdfTarget)
          if ('error' in result) throw Object.assign(new Error(result.error.message), { code: result.error.code })
          output = result
          failed = false
        }

        const json = `${JSON.stringify(output, null, 2)}\n`
        if (options.out) {
          await storage.writeFile(options.out, json)
          console.error(kleur.green(`✓ Extraction written to ${options.out}`))
        } else {
          process.stdout.write(json)
        }
        process.exit(failed ? 1 : 0)
      } catch (error) {
        const { code, message } = errorOf(error)
        console.error(kleur.red(`Error${code === 'extract_error' ? '' : ` (${code})`}: ${message}`))
        process.exit(1)
      }
    })

  return extract
}
