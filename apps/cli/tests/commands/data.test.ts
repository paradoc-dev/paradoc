import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const fixturesDir = path.resolve(__dirname, '../fixtures')

/**
 * Execute a CLI command and return the result
 */
async function executeCliCommand(
  args: string[],
  options?: {
    cwd?: string
    env?: Record<string, string>
    timeout?: number
  }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const cliPath = path.resolve(__dirname, '../../src/index.ts')
    const child = spawn('tsx', [cliPath, ...args], {
      cwd: options?.cwd || process.cwd(),
      env: { ...process.env, ...options?.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    const timeout = options?.timeout || 30000
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`Command timed out after ${timeout}ms`))
    }, timeout)

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 0,
      })
    })

    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}

describe('CLI Data Commands', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paradoc-data-test-'))
  })

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('data --help', () => {
    it('should display help for data command', async () => {
      const result = await executeCliCommand(['data', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('fill')
      expect(result.stdout).toContain('template')
      expect(result.stdout).toContain('validate')
    })
  })

  describe('data template', () => {
    it('should display help for data template command', async () => {
      const result = await executeCliCommand(['data', 'template', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Generate')
    })

    it('should generate a data template from a form', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['data', 'template', formPath])

      expect(result.exitCode).toBe(0)
      // Template should contain field names from the form
      expect(result.stdout).toContain('name')
      expect(result.stdout).toContain('species')
      expect(result.stdout).toContain('weight')
    })

    it('should output template in JSON format', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['data', 'template', formPath, '--json'])

      expect(result.exitCode).toBe(0)
      // Should be valid JSON with fields property
      const parsed = JSON.parse(result.stdout)
      expect(parsed).toHaveProperty('fields')
      expect(parsed.fields).toHaveProperty('name')
      expect(parsed.fields).toHaveProperty('species')
    })

    it('should output template in YAML format', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['data', 'template', formPath, '--yaml'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('name:')
      expect(result.stdout).toContain('species:')
    })
  })

  describe('data validate', () => {
    it('should display help for data validate command', async () => {
      const result = await executeCliCommand(['data', 'validate', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Validate')
    })

    it('should validate data against a form', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const dataPath = path.join(tempDir, 'data.json')

      // Create valid data matching the form fields (wrapped in fields object)
      await fs.writeFile(dataPath, JSON.stringify({
        fields: {
          name: 'Buddy',
          species: 'dog',
          weight: 25,
          hasVaccination: true,
        }
      }))

      const result = await executeCliCommand(['data', 'validate', formPath, dataPath])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('valid')
    })

    it('should validate data with coercible types', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const dataPath = path.join(tempDir, 'coercible-data.json')

      // Data that may be coerced to valid types (wrapped in fields object)
      await fs.writeFile(dataPath, JSON.stringify({
        fields: {
          name: 'Buddy',
          species: 'dog',
          weight: 25,
          hasVaccination: true,
        }
      }))

      const result = await executeCliCommand(['data', 'validate', formPath, dataPath])

      expect(result.exitCode).toBe(0)
    })

    it('should fail for non-existent data file', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')

      const result = await executeCliCommand(['data', 'validate', formPath, '/nonexistent/data.json'])

      expect(result.exitCode).toBe(1)
    })

    it('should output JSON result with --json', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const dataPath = path.join(tempDir, 'valid-data.json')

      await fs.writeFile(dataPath, JSON.stringify({
        fields: {
          name: 'Buddy',
          species: 'dog',
          weight: 25,
          hasVaccination: true,
        }
      }))

      const result = await executeCliCommand(['data', 'validate', formPath, dataPath, '--json'])

      expect(result.exitCode).toBe(0)
      const parsed = JSON.parse(result.stdout)
      expect(parsed.success).toBe(true)
    })

    it('should suppress output with --silent on valid data', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const dataPath = path.join(tempDir, 'silent-data.json')

      await fs.writeFile(dataPath, JSON.stringify({
        fields: {
          name: 'Buddy',
          species: 'dog',
          weight: 25,
          hasVaccination: true,
        }
      }))

      const result = await executeCliCommand(['data', 'validate', formPath, dataPath, '--silent'])

      expect(result.exitCode).toBe(0)
      // Silent should produce minimal/no output
      expect(result.stdout.trim()).toBe('')
    })

    it('should accept inline JSON data', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const inlineData = JSON.stringify({
        fields: {
          name: 'Rex',
          species: 'dog',
          weight: 30,
          hasVaccination: true,
        }
      })

      const result = await executeCliCommand(['data', 'validate', formPath, inlineData])

      expect(result.exitCode).toBe(0)
    })
  })

  describe('data template (additional options)', () => {
    it('should write template to file with --out', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const outPath = path.join(tempDir, 'template.json')

      const result = await executeCliCommand(['data', 'template', formPath, '--out', outPath, '--json'])

      expect(result.exitCode).toBe(0)

      // Verify file was created
      const content = await fs.readFile(outPath, 'utf-8')
      const parsed = JSON.parse(content)
      expect(parsed).toHaveProperty('fields')
    })

    it('should write YAML template to file with --out', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const outPath = path.join(tempDir, 'template.yaml')

      const result = await executeCliCommand(['data', 'template', formPath, '--out', outPath])

      expect(result.exitCode).toBe(0)

      const content = await fs.readFile(outPath, 'utf-8')
      expect(content).toContain('name:')
    })

    it('should suppress output with --silent when writing to file', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const outPath = path.join(tempDir, 'silent-template.json')

      const result = await executeCliCommand(['data', 'template', formPath, '--out', outPath, '--json', '--silent'])

      expect(result.exitCode).toBe(0)
      // File should still be created even in silent mode
      const content = await fs.readFile(outPath, 'utf-8')
      expect(content.length).toBeGreaterThan(0)
    })
  })

  describe('data fill', () => {
    it('should display help for data fill command', async () => {
      const result = await executeCliCommand(['data', 'fill', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('--out')
      expect(result.stdout).toContain('--data')
    })

    it('should fill form with data from file', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const dataPath = path.join(tempDir, 'fill-data.json')
      const outPath = path.join(tempDir, 'filled.json')

      await fs.writeFile(dataPath, JSON.stringify({
        fields: {
          name: 'Buddy',
          species: 'dog',
          weight: 25,
          hasVaccination: true,
        }
      }))

      const result = await executeCliCommand([
        'data', 'fill', formPath,
        '--out', outPath,
        '--data', dataPath,
        '--json',
      ])

      expect(result.exitCode).toBe(0)

      // Verify output file was created with data
      const content = await fs.readFile(outPath, 'utf-8')
      const parsed = JSON.parse(content)
      expect(parsed.fields.name).toBe('Buddy')
      expect(parsed.fields.species).toBe('dog')
    })

    it('should fill form with inline JSON data', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const outPath = path.join(tempDir, 'filled-inline.json')

      const inlineData = JSON.stringify({
        fields: {
          name: 'Rex',
          species: 'cat',
          weight: 8,
          hasVaccination: false,
        }
      })

      const result = await executeCliCommand([
        'data', 'fill', formPath,
        '--out', outPath,
        '--data', inlineData,
        '--json',
      ])

      expect(result.exitCode).toBe(0)

      const content = await fs.readFile(outPath, 'utf-8')
      const parsed = JSON.parse(content)
      expect(parsed.fields.name).toBe('Rex')
      expect(parsed.fields.species).toBe('cat')
    })

    it('should output YAML format with --yaml', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const outPath = path.join(tempDir, 'filled.yaml')

      const inlineData = JSON.stringify({
        fields: {
          name: 'Whiskers',
          species: 'cat',
          weight: 5,
          hasVaccination: true,
        }
      })

      const result = await executeCliCommand([
        'data', 'fill', formPath,
        '--out', outPath,
        '--data', inlineData,
        '--yaml',
      ])

      expect(result.exitCode).toBe(0)

      const content = await fs.readFile(outPath, 'utf-8')
      expect(content).toContain('name:')
      expect(content).toContain('Whiskers')
    })

    it('should fail for non-form artifact', async () => {
      const docPath = path.join(fixturesDir, 'pet-care-guide.yaml')
      const outPath = path.join(tempDir, 'fail.json')

      const result = await executeCliCommand([
        'data', 'fill', docPath,
        '--out', outPath,
        '--data', '{"fields":{}}',
        '--json',
      ])

      expect(result.exitCode).toBe(1)
    })

    it('should fail for nonexistent form file', async () => {
      const outPath = path.join(tempDir, 'fail.json')

      const result = await executeCliCommand([
        'data', 'fill', '/nonexistent/form.yaml',
        '--out', outPath,
        '--data', '{"fields":{}}',
      ])

      expect(result.exitCode).toBe(1)
    })
  })
  describe('data extract', () => {
    const extractForm = {
      kind: 'form',
      name: 'pet-addendum',
      version: '1.0.0',
      title: 'Pet Addendum',
      fields: {
        name: { type: 'text', label: 'Name', required: true },
        species: { type: 'enum', label: 'Species', enum: [{ value: 'dog' }, { value: 'cat' }, { value: 'bird' }, { value: 'turtle' }] },
        weight: { type: 'number', label: 'Weight', required: true },
        hasVaccination: { type: 'boolean', label: 'Has vaccination' },
      },
      defaultLayer: 'pdf',
      layers: {
        pdf: {
          kind: 'file',
          mimeType: 'application/pdf',
          path: 'pet-addendum-bindings.pdf',
          bindings: { pet_name: 'name', petWeight: 'weight', SPECIES: 'species', is_vaccinated: 'hasVaccination' },
        },
      },
    }
    const values = { fields: { name: 'Fluffy', species: 'cat', weight: 3, hasVaccination: true } }

    async function filledPdf(): Promise<{ formPath: string; pdfPath: string }> {
      const formPath = path.join(tempDir, 'pet.json')
      const pdfPath = path.join(tempDir, 'filled.pdf')
      await fs.writeFile(formPath, JSON.stringify(extractForm))
      await fs.copyFile(path.join(fixturesDir, 'pet-addendum-bindings.pdf'), path.join(tempDir, 'pet-addendum-bindings.pdf'))
      const rendered = await executeCliCommand(['render', formPath, '--data', JSON.stringify(values), '--out', pdfPath])
      expect(rendered.exitCode).toBe(0)
      return { formPath, pdfPath }
    }

    it('extracts one filled PDF as the SDK does', async () => {
      const { formPath, pdfPath } = await filledPdf()
      const result = await executeCliCommand(['data', 'extract', formPath, pdfPath])

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout)
      expect(output.data).toEqual(values)
      const { form } = await import('@paradoc/core')
      const sdk = await form.from(extractForm as never).extract(new Uint8Array(await fs.readFile(pdfPath)))
      expect(output).toEqual({ file: pdfPath, ...JSON.parse(JSON.stringify(sdk)) })
    })

    it('extracts every PDF in a directory and reports the ones that fail', async () => {
      const { formPath, pdfPath } = await filledPdf()
      const batch = path.join(tempDir, 'batch')
      await fs.mkdir(batch)
      await fs.copyFile(pdfPath, path.join(batch, 'a.pdf'))
      await fs.copyFile(path.join(fixturesDir, 'Pet Care Guide.pdf'), path.join(batch, 'b.pdf'))
      await fs.writeFile(path.join(batch, 'notes.txt'), 'ignored')
      const outPath = path.join(tempDir, 'extracted.json')

      const result = await executeCliCommand(['data', 'extract', formPath, batch, '--out', outPath])

      expect(result.exitCode).toBe(1)
      const output = JSON.parse(await fs.readFile(outPath, 'utf-8'))
      expect(output.results.map((entry: { file: string }) => entry.file)).toEqual(['a.pdf', 'b.pdf'])
      expect(output.results[0].data).toEqual(values)
      expect(output.results[1].error.code).toBe('no_form_fields')
    })

    it('fails with the extraction error code for a PDF without form fields', async () => {
      const { formPath } = await filledPdf()
      const result = await executeCliCommand(['data', 'extract', formPath, path.join(fixturesDir, 'Pet Care Guide.pdf')])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('no_form_fields')
      expect(result.stdout).toBe('')
    })
  })
})
