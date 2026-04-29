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

describe('CLI Project Commands', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paradoc-project-test-'))
  })

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('init command', () => {
    it('should display help for init command', async () => {
      const result = await executeCliCommand(['init', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Initialize')
    })

    it('should initialize a new project with --name', async () => {
      const result = await executeCliCommand(['init', '--yes', '--name', 'Test Project'], { cwd: tempDir })

      expect(result.exitCode).toBe(0)

      // Check that .paradoc directory was created
      const paradocDir = path.join(tempDir, '.paradoc')
      const stats = await fs.stat(paradocDir)
      expect(stats.isDirectory()).toBe(true)
    })

    it('should create paradoc.json manifest', async () => {
      await executeCliCommand(['init', '--yes', '--name', 'Test Project'], { cwd: tempDir })

      const manifestPath = path.join(tempDir, 'paradoc.json')
      const stats = await fs.stat(manifestPath)
      expect(stats.isFile()).toBe(true)

      const content = await fs.readFile(manifestPath, 'utf-8')
      const manifest = JSON.parse(content)
      expect(manifest).toHaveProperty('$schema')
    })

    it('should require --name with --yes', async () => {
      const result = await executeCliCommand(['init', '--yes'], { cwd: tempDir })

      expect(result.exitCode).toBe(1)
      // Error message may be in stdout or stderr
      const output = result.stdout + result.stderr
      expect(output).toContain('--name is required')
    })
  })

  describe('add command (registry-based)', () => {
    it('should display help for add command', async () => {
      const result = await executeCliCommand(['add', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('add')
      expect(result.stdout).toContain('artifact')
    })

    it('should validate artifact reference format', async () => {
      // Invalid format - missing @
      const result = await executeCliCommand(['add', 'invalid-ref'], { cwd: tempDir })

      expect(result.exitCode).toBe(1)
      const output = result.stdout + result.stderr
      expect(output).toContain('Invalid artifact')
    })

    it('should show error when not in a project', async () => {
      const result = await executeCliCommand(['add', '@acme/test-form'], { cwd: tempDir })

      expect(result.exitCode).toBe(1)
      const output = result.stdout + result.stderr
      expect(output).toContain('Not in an Paradoc project')
    })

    it('should support layers option', async () => {
      const result = await executeCliCommand(['add', '--help'])

      expect(result.stdout).toContain('--layers')
    })

    it('should support output option', async () => {
      const result = await executeCliCommand(['add', '--help'])

      expect(result.stdout).toContain('--output')
    })
  })

  describe('diff command', () => {
    it('should display help for diff command', async () => {
      const result = await executeCliCommand(['diff', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('diff')
    })

    it('should require two file arguments', async () => {
      // Initialize repository
      await executeCliCommand(['init', '--yes', '--name', 'Test Project'], { cwd: tempDir })

      // Create a form (default format is JSON)
      await executeCliCommand(['new', 'form', 'test-form', '--yes'], { cwd: tempDir })

      // Run diff with only one file
      const result = await executeCliCommand(['diff', 'test-form.json'], { cwd: tempDir })

      expect(result.exitCode).toBe(1)
    })

    it('should compare two artifact files', async () => {
      // Initialize repository
      await executeCliCommand(['init', '--yes', '--name', 'Test Project'], { cwd: tempDir })

      // Create two forms (default format is JSON)
      await executeCliCommand(['new', 'form', 'form-a', '--yes'], { cwd: tempDir })
      await executeCliCommand(['new', 'form', 'form-b', '--yes'], { cwd: tempDir })

      // Run diff
      const result = await executeCliCommand(['diff', 'form-a.json', 'form-b.json'], { cwd: tempDir })

      // Should succeed (both files exist)
      expect(result.exitCode).toBe(0)
    })
  })

  describe('show command', () => {
    it('should display help for show command', async () => {
      const result = await executeCliCommand(['show', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('show')
    })

    it('should show artifact details', async () => {
      // Initialize repository
      await executeCliCommand(['init', '--yes', '--name', 'Test Project'], { cwd: tempDir })

      // Create a form (default format is JSON)
      await executeCliCommand(['new', 'form', 'test-form', '--yes'], { cwd: tempDir })

      // Show artifact
      const result = await executeCliCommand(['show', 'test-form.json'], { cwd: tempDir })

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('test-form')
      expect(result.stdout).toContain('form')
    })

    it('should support raw output mode', async () => {
      const result = await executeCliCommand(['show', '--help'])

      expect(result.stdout).toContain('--raw')
    })

    it('should fail for non-existent file', async () => {
      const result = await executeCliCommand(['show', 'nonexistent.yaml'], { cwd: tempDir })

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('not found')
    })
  })
})
