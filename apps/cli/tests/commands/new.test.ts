import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
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

    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}

describe('CLI New Command', () => {
  let tempDir: string

  beforeEach(async () => {
    // Create a temporary directory for test artifacts
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paradoc-test-'))
  })

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('new --help', () => {
    it('should display help for new command', async () => {
      const result = await executeCliCommand(['new', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Create new Paradoc artifacts')
      // Should list supported artifact types
      expect(result.stdout).toContain('form')
      expect(result.stdout).toContain('checklist')
      expect(result.stdout).toContain('document')
      expect(result.stdout).toContain('bundle')
    })
  })

  describe('new form', () => {
    it('should display help for new form command', async () => {
      const result = await executeCliCommand(['new', 'form', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Create a new form')
      expect(result.stdout).toContain('--slug')
      expect(result.stdout).toContain('--title')
      expect(result.stdout).toContain('--description')
      expect(result.stdout).toContain('--format')
    })

    it('should create a form artifact with --yes flag', async () => {
      const result = await executeCliCommand(
        ['new', 'form', 'test-form', '--yes'],
        { cwd: tempDir }
      )

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Created')
      expect(result.stdout).toContain('Kind:')
      expect(result.stdout).toContain('form')

      // Check file was created
      const files = await fs.readdir(tempDir)
      expect(files.some((f) => f.includes('test-form') && f.endsWith('.json'))).toBe(true)
    })

    it('should create form in YAML format', async () => {
      const result = await executeCliCommand(
        ['new', 'form', 'yaml-form', '--yes', '--format', 'yaml'],
        { cwd: tempDir }
      )

      expect(result.exitCode).toBe(0)

      const files = await fs.readdir(tempDir)
      expect(files.some((f) => f.includes('yaml-form') && f.endsWith('.yaml'))).toBe(true)
    })

    it('should support dry-run mode', async () => {
      const result = await executeCliCommand(
        ['new', 'form', 'dry-form', '--yes', '--dry-run'],
        { cwd: tempDir }
      )

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('kind')

      // Check file was NOT created
      const files = await fs.readdir(tempDir)
      expect(files.some((f) => f.includes('dry-form'))).toBe(false)
    })
  })

  describe('new document', () => {
    it('should display help for new document command', async () => {
      const result = await executeCliCommand(['new', 'document', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Create a new document')
    })

    it('should create a document artifact with --yes flag', async () => {
      const result = await executeCliCommand(
        ['new', 'document', 'test-doc', '--yes'],
        { cwd: tempDir }
      )

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Created')
      expect(result.stdout).toContain('Kind:')
      expect(result.stdout).toContain('document')

      const files = await fs.readdir(tempDir)
      expect(files.some((f) => f.includes('test-doc') && f.endsWith('.json'))).toBe(true)
    })
  })

  describe('new checklist', () => {
    it('should display help for new checklist command', async () => {
      const result = await executeCliCommand(['new', 'checklist', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Create a new checklist')
    })

    it('should create a checklist artifact with --yes flag', async () => {
      const result = await executeCliCommand(
        ['new', 'checklist', 'test-checklist', '--yes'],
        { cwd: tempDir }
      )

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Created')
      expect(result.stdout).toContain('Kind:')
      expect(result.stdout).toContain('checklist')

      const files = await fs.readdir(tempDir)
      expect(files.some((f) => f.includes('test-checklist') && f.endsWith('.json'))).toBe(true)
    })
  })

  describe('new bundle', () => {
    it('should display help for new bundle command', async () => {
      const result = await executeCliCommand(['new', 'bundle', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Create a new bundle')
    })

    it('should create a bundle artifact with --yes flag', async () => {
      const result = await executeCliCommand(
        ['new', 'bundle', 'test-bundle', '--yes'],
        { cwd: tempDir }
      )

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Created')
      expect(result.stdout).toContain('Kind:')
      expect(result.stdout).toContain('bundle')

      const files = await fs.readdir(tempDir)
      expect(files.some((f) => f.includes('test-bundle') && f.endsWith('.json'))).toBe(true)
    })
  })

  describe('new form (options)', () => {
    it('should create form with custom --slug', async () => {
      const result = await executeCliCommand(
        ['new', 'form', 'My Test Form', '--yes', '--slug', 'custom-slug'],
        { cwd: tempDir }
      )

      expect(result.exitCode).toBe(0)

      const files = await fs.readdir(tempDir)
      expect(files.some((f) => f.includes('custom-slug'))).toBe(true)
    })

    it('should create form with custom --title', async () => {
      const result = await executeCliCommand(
        ['new', 'form', 'titled-form', '--yes', '--title', 'My Custom Title'],
        { cwd: tempDir }
      )

      expect(result.exitCode).toBe(0)

      const files = await fs.readdir(tempDir)
      const jsonFile = files.find((f) => f.endsWith('.json'))!
      const content = await fs.readFile(path.join(tempDir, jsonFile), 'utf-8')
      const artifact = JSON.parse(content)
      expect(artifact.title).toBe('My Custom Title')
    })

    it('should create form with --description', async () => {
      const result = await executeCliCommand(
        ['new', 'form', 'desc-form', '--yes', '--description', 'A test description'],
        { cwd: tempDir }
      )

      expect(result.exitCode).toBe(0)

      const files = await fs.readdir(tempDir)
      const jsonFile = files.find((f) => f.endsWith('.json'))!
      const content = await fs.readFile(path.join(tempDir, jsonFile), 'utf-8')
      const artifact = JSON.parse(content)
      expect(artifact.description).toBe('A test description')
    })

    it('should create form with --code', async () => {
      const result = await executeCliCommand(
        ['new', 'form', 'coded-form', '--yes', '--code', 'FORM-001'],
        { cwd: tempDir }
      )

      expect(result.exitCode).toBe(0)

      const files = await fs.readdir(tempDir)
      const jsonFile = files.find((f) => f.endsWith('.json'))!
      const content = await fs.readFile(path.join(tempDir, jsonFile), 'utf-8')
      const artifact = JSON.parse(content)
      expect(artifact.code).toBe('FORM-001')
    })

    it('should create form with --artifact-version', async () => {
      const result = await executeCliCommand(
        ['new', 'form', 'versioned-form', '--yes', '--artifact-version', '2.5.0'],
        { cwd: tempDir }
      )

      expect(result.exitCode).toBe(0)

      const files = await fs.readdir(tempDir)
      const jsonFile = files.find((f) => f.endsWith('.json'))!
      const content = await fs.readFile(path.join(tempDir, jsonFile), 'utf-8')
      const artifact = JSON.parse(content)
      expect(artifact.version).toBe('2.5.0')
    })

    it('should create form with --field options', async () => {
      const result = await executeCliCommand(
        ['new', 'form', 'fielded-form', '--yes', '--field', 'email:email', '--field', 'age:number'],
        { cwd: tempDir }
      )

      expect(result.exitCode).toBe(0)

      const files = await fs.readdir(tempDir)
      const jsonFile = files.find((f) => f.endsWith('.json'))!
      const content = await fs.readFile(path.join(tempDir, jsonFile), 'utf-8')
      const artifact = JSON.parse(content)
      expect(artifact.fields).toHaveProperty('email')
      expect(artifact.fields.email.type).toBe('email')
      expect(artifact.fields).toHaveProperty('age')
      expect(artifact.fields.age.type).toBe('number')
    })

    it('should create form in custom --dir', async () => {
      const subDir = 'artifacts'

      const result = await executeCliCommand(
        ['new', 'form', 'dir-form', '--yes', '--dir', subDir],
        { cwd: tempDir }
      )

      expect(result.exitCode).toBe(0)

      const files = await fs.readdir(path.join(tempDir, subDir))
      expect(files.some((f) => f.endsWith('.json'))).toBe(true)
    })
  })

  describe('new checklist (options)', () => {
    it('should create checklist with --item options', async () => {
      const result = await executeCliCommand(
        ['new', 'checklist', 'todo-list', '--yes', '--item', 'Task 1', '--item', 'Task 2', '--item', 'Task 3'],
        { cwd: tempDir }
      )

      expect(result.exitCode).toBe(0)

      const files = await fs.readdir(tempDir)
      const jsonFile = files.find((f) => f.endsWith('.json'))!
      const content = await fs.readFile(path.join(tempDir, jsonFile), 'utf-8')
      const artifact = JSON.parse(content)
      expect(artifact.items).toHaveLength(3)
    })
  })

  describe('new document (options)', () => {
    it('should create document with all metadata options', async () => {
      const result = await executeCliCommand(
        [
          'new', 'document', 'full-doc', '--yes',
          '--title', 'Full Document',
          '--description', 'A complete test',
          '--code', 'DOC-100',
          '--artifact-version', '3.0.0',
          '--format', 'yaml',
        ],
        { cwd: tempDir }
      )

      expect(result.exitCode).toBe(0)

      const files = await fs.readdir(tempDir)
      expect(files.some((f) => f.endsWith('.yaml'))).toBe(true)
    })
  })

  describe('new bundle (options)', () => {
    it('should create bundle with metadata', async () => {
      const result = await executeCliCommand(
        ['new', 'bundle', 'full-bundle', '--yes', '--title', 'Full Bundle', '--description', 'A test bundle'],
        { cwd: tempDir }
      )

      expect(result.exitCode).toBe(0)

      const files = await fs.readdir(tempDir)
      const jsonFile = files.find((f) => f.endsWith('.json'))!
      const content = await fs.readFile(path.join(tempDir, jsonFile), 'utf-8')
      const artifact = JSON.parse(content)
      expect(artifact.title).toBe('Full Bundle')
      expect(artifact.description).toBe('A test bundle')
    })
  })
})
