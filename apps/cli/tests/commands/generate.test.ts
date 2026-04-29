import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

describe('para generate', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'paradoc-generate-test-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  describe('help and usage', () => {
    it('shows help for generate command', async () => {
      const result = await executeCliCommand(['generate', '--help'])
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Generate TypeScript types for an artifact file')
      expect(result.stdout).toContain('--output')
      expect(result.stdout).toContain('typed')
      expect(result.stdout).toContain('ts')
    })
  })

  describe('error handling', () => {
    it('shows error for non-existent file', async () => {
      const result = await executeCliCommand(['generate', '/tmp/nonexistent-artifact.json'])
      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain('Could not read file')
    })

    it('shows error for unsupported file extension', async () => {
      const txtFile = join(tempDir, 'artifact.txt')
      await fs.writeFile(txtFile, 'some content')

      const result = await executeCliCommand(['generate', txtFile])
      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain('Unsupported file extension')
    })

    it('shows error for invalid JSON', async () => {
      const jsonFile = join(tempDir, 'invalid.json')
      await fs.writeFile(jsonFile, '{ invalid json }')

      const result = await executeCliCommand(['generate', jsonFile])
      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain('Could not parse file')
    })

    it('shows error for missing kind field', async () => {
      const jsonFile = join(tempDir, 'no-kind.json')
      await fs.writeFile(jsonFile, JSON.stringify({ name: 'test', version: '1.0.0' }))

      const result = await executeCliCommand(['generate', jsonFile])
      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain('does not appear to be a valid artifact')
    })

    it('shows error for invalid kind', async () => {
      const jsonFile = join(tempDir, 'bad-kind.json')
      await fs.writeFile(jsonFile, JSON.stringify({ kind: 'unknown', name: 'test', version: '1.0.0' }))

      const result = await executeCliCommand(['generate', jsonFile])
      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain('Invalid artifact kind')
    })

    it('shows error for invalid output format', async () => {
      const jsonFile = join(tempDir, 'test.json')
      await fs.writeFile(jsonFile, JSON.stringify({ kind: 'form', name: 'test', version: '1.0.0', title: 'Test' }))

      const result = await executeCliCommand(['generate', jsonFile, '--output', 'invalid'])
      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain('Invalid output format')
    })
  })

  describe('typed output (JSON + .d.ts)', () => {
    it('generates .d.ts file for JSON artifact', async () => {
      const jsonFile = join(tempDir, 'my-form.json')
      await fs.writeFile(jsonFile, JSON.stringify({
        kind: 'form',
        name: 'my-form',
        version: '1.0.0',
        title: 'My Form',
        fields: {
          name: { type: 'text', label: 'Name' }
        }
      }, null, 2))

      const result = await executeCliCommand(['generate', jsonFile, '--output', 'typed'])
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Generated')
      expect(result.stdout).toContain('.d.ts')

      // Verify .d.ts file was created
      const dtsFile = join(tempDir, 'my-form.json.d.ts')
      const dtsContent = await fs.readFile(dtsFile, 'utf-8')
      expect(dtsContent).toContain('declare const schema')
      expect(dtsContent).toContain('readonly kind: "form"')
      expect(dtsContent).toContain('export default schema')
    })

    it('generates JSON + .d.ts from YAML artifact', async () => {
      const yamlFile = join(tempDir, 'my-doc.yaml')
      await fs.writeFile(yamlFile, `
kind: document
name: my-doc
version: 1.0.0
title: My Document
`)

      const result = await executeCliCommand(['generate', yamlFile, '--output', 'typed'])
      expect(result.exitCode).toBe(0)

      // Verify JSON file was created
      const jsonFile = join(tempDir, 'my-doc.json')
      const jsonContent = await fs.readFile(jsonFile, 'utf-8')
      expect(JSON.parse(jsonContent).kind).toBe('document')

      // Verify .d.ts file was created
      const dtsFile = join(tempDir, 'my-doc.json.d.ts')
      const dtsContent = await fs.readFile(dtsFile, 'utf-8')
      expect(dtsContent).toContain('readonly kind: "document"')
    })

    it('uses typed as default output format', async () => {
      const jsonFile = join(tempDir, 'default-format.json')
      await fs.writeFile(jsonFile, JSON.stringify({
        kind: 'checklist',
        name: 'default-format',
        version: '1.0.0',
        title: 'Default Format',
        items: []
      }))

      const result = await executeCliCommand(['generate', jsonFile])
      expect(result.exitCode).toBe(0)

      // Should generate .d.ts without specifying --output
      const dtsFile = join(tempDir, 'default-format.json.d.ts')
      const dtsExists = await fs.access(dtsFile).then(() => true).catch(() => false)
      expect(dtsExists).toBe(true)
    })
  })

  describe('ts output (TypeScript module)', () => {
    it('generates TypeScript module from JSON artifact', async () => {
      const jsonFile = join(tempDir, 'my-bundle.json')
      await fs.writeFile(jsonFile, JSON.stringify({
        kind: 'bundle',
        name: 'my-bundle',
        version: '1.0.0',
        title: 'My Bundle',
        contents: []
      }))

      const result = await executeCliCommand(['generate', jsonFile, '--output', 'ts'])
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Generated')
      expect(result.stdout).toContain('.ts')

      // Verify .ts file was created with embedded schema
      const tsFile = join(tempDir, 'my-bundle.ts')
      const tsContent = await fs.readFile(tsFile, 'utf-8')
      expect(tsContent).toContain('const schema =')
      expect(tsContent).toContain('as const')
      expect(tsContent).toContain("import { para } from '@paradoc/sdk'")
      expect(tsContent).toContain('export const myBundle = para.bundle(schema)')
      expect(tsContent).toContain('export type MyBundleBundle = typeof myBundle')
    })

    it('generates TypeScript module from YAML artifact', async () => {
      const yamlFile = join(tempDir, 'yaml-form.yaml')
      await fs.writeFile(yamlFile, `
kind: form
name: yaml-form
version: 1.0.0
title: YAML Form
fields:
  email:
    type: email
    label: Email
`)

      const result = await executeCliCommand(['generate', yamlFile, '--output', 'ts'])
      expect(result.exitCode).toBe(0)

      // Verify .ts file was created with embedded schema
      const tsFile = join(tempDir, 'yaml-form.ts')
      const tsContent = await fs.readFile(tsFile, 'utf-8')
      expect(tsContent).toContain('const schema =')
      expect(tsContent).toContain('as const')
      expect(tsContent).toContain('export const yamlForm = para.form(schema)')

      // JSON file should NOT be created (schema is embedded)
      const jsonFile = join(tempDir, 'yaml-form.json')
      const jsonExists = await fs.access(jsonFile).then(() => true).catch(() => false)
      expect(jsonExists).toBe(false)
    })

    it('converts kebab-case names to camelCase exports', async () => {
      const jsonFile = join(tempDir, 'my-complex-form-name.json')
      await fs.writeFile(jsonFile, JSON.stringify({
        kind: 'form',
        name: 'my-complex-form-name',
        version: '1.0.0',
        title: 'Complex Form'
      }))

      const result = await executeCliCommand(['generate', jsonFile, '--output', 'ts'])
      expect(result.exitCode).toBe(0)

      const tsFile = join(tempDir, 'my-complex-form-name.ts')
      const tsContent = await fs.readFile(tsFile, 'utf-8')
      expect(tsContent).toContain('export const myComplexFormName = para.form(schema)')
    })
  })

  describe('all artifact kinds', () => {
    it('generates types for form artifact', async () => {
      const file = join(tempDir, 'form.json')
      await fs.writeFile(file, JSON.stringify({ kind: 'form', name: 'f', version: '1.0.0', title: 'F' }))

      const result = await executeCliCommand(['generate', file, '--output', 'ts'])
      expect(result.exitCode).toBe(0)

      const tsContent = await fs.readFile(join(tempDir, 'form.ts'), 'utf-8')
      expect(tsContent).toContain('para.form(schema)')
      expect(tsContent).toContain('FormPayload') // Forms get payload type
    })

    it('generates types for document artifact', async () => {
      const file = join(tempDir, 'doc.json')
      await fs.writeFile(file, JSON.stringify({ kind: 'document', name: 'd', version: '1.0.0', title: 'D' }))

      const result = await executeCliCommand(['generate', file, '--output', 'ts'])
      expect(result.exitCode).toBe(0)

      const tsContent = await fs.readFile(join(tempDir, 'doc.ts'), 'utf-8')
      expect(tsContent).toContain('para.document(schema)')
      expect(tsContent).not.toContain('Payload') // Documents don't get payload type
    })

    it('generates types for checklist artifact', async () => {
      const file = join(tempDir, 'checklist.json')
      await fs.writeFile(file, JSON.stringify({ kind: 'checklist', name: 'c', version: '1.0.0', title: 'C', items: [] }))

      const result = await executeCliCommand(['generate', file, '--output', 'ts'])
      expect(result.exitCode).toBe(0)

      const tsContent = await fs.readFile(join(tempDir, 'checklist.ts'), 'utf-8')
      expect(tsContent).toContain('para.checklist(schema)')
      expect(tsContent).toContain('ChecklistPayload') // Checklists get payload type
    })

    it('generates types for bundle artifact', async () => {
      const file = join(tempDir, 'bundle.json')
      await fs.writeFile(file, JSON.stringify({ kind: 'bundle', name: 'b', version: '1.0.0', title: 'B', contents: [] }))

      const result = await executeCliCommand(['generate', file, '--output', 'ts'])
      expect(result.exitCode).toBe(0)

      const tsContent = await fs.readFile(join(tempDir, 'bundle.ts'), 'utf-8')
      expect(tsContent).toContain('para.bundle(schema)')
      expect(tsContent).not.toContain('Payload') // Bundles don't get payload type
    })
  })

  describe('usage hint output', () => {
    it('shows typed import hint for typed output', async () => {
      const file = join(tempDir, 'hint-test.json')
      await fs.writeFile(file, JSON.stringify({ kind: 'form', name: 'hint-test', version: '1.0.0', title: 'T' }))

      const result = await executeCliCommand(['generate', file, '--output', 'typed'])
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("import schema from './hint-test.json'")
      expect(result.stdout).toContain("import { para } from '@paradoc/sdk'")
    })

    it('shows ts import hint for ts output', async () => {
      const file = join(tempDir, 'ts-hint.json')
      await fs.writeFile(file, JSON.stringify({ kind: 'form', name: 'ts-hint', version: '1.0.0', title: 'T' }))

      const result = await executeCliCommand(['generate', file, '--output', 'ts'])
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("import { tsHint } from './ts-hint.js'")
    })
  })
})
