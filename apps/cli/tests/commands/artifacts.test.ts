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

describe('CLI Artifact Commands', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paradoc-artifact-test-'))
  })

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('inspect command', () => {
    it('should display help for inspect command', async () => {
      const result = await executeCliCommand(['inspect', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Inspect')
    })

    it('should fail for non-existent file', async () => {
      const result = await executeCliCommand(['inspect', '/nonexistent/file.yaml'])

      expect(result.exitCode).toBe(1)
    })
  })

  describe('fix command', () => {
    it('should display help for fix command', async () => {
      const result = await executeCliCommand(['fix', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Fix')
    })
  })

  describe('render command', () => {
    it('should display help for render command', async () => {
      const result = await executeCliCommand(['render', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Render')
    })
  })

  describe('attach command', () => {
    it('should display help for attach command', async () => {
      const result = await executeCliCommand(['attach', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Attach')
    })
  })

  describe('version command (artifact version)', () => {
    it('should display help for version command', async () => {
      const result = await executeCliCommand(['version', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('version')
    })

    it('should require repo for version command', async () => {
      // Create a form artifact outside a repo
      const formPath = path.join(tempDir, 'form.json')
      await fs.writeFile(formPath, JSON.stringify({
        kind: 'form',
        name: 'test-form',
        title: 'Test Form',
        version: '1.0.0',
        fields: {},
      }))

      const result = await executeCliCommand(['version', formPath, 'patch'], { cwd: tempDir })

      // Should fail because not in a repo
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('Not an Paradoc repository')
    })

    it('should bump version in initialized repo', async () => {
      // Initialize repo first
      await executeCliCommand(['init', '--yes', '--name', 'Test Project'], { cwd: tempDir })

      // Create a form artifact
      const formPath = path.join(tempDir, 'form.json')
      await fs.writeFile(
        formPath,
        JSON.stringify({
          kind: 'form',
          name: 'test-form',
          title: 'Test Form',
          version: '1.0.0',
          fields: {},
        })
      )

      const result = await executeCliCommand(['version', formPath, 'patch'], { cwd: tempDir })

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('1.0.1')
    })

    it('should bump major version', async () => {
      await executeCliCommand(['init', '--yes', '--name', 'Test Project'], { cwd: tempDir })

      const formPath = path.join(tempDir, 'form.json')
      await fs.writeFile(formPath, JSON.stringify({
        kind: 'form', name: 'test-form', title: 'Test', version: '1.2.3', fields: {},
      }))

      const result = await executeCliCommand(['version', formPath, 'major'], { cwd: tempDir })

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('2.0.0')
    })

    it('should bump minor version', async () => {
      await executeCliCommand(['init', '--yes', '--name', 'Test Project'], { cwd: tempDir })

      const formPath = path.join(tempDir, 'form.json')
      await fs.writeFile(formPath, JSON.stringify({
        kind: 'form', name: 'test-form', title: 'Test', version: '1.2.3', fields: {},
      }))

      const result = await executeCliCommand(['version', formPath, 'minor'], { cwd: tempDir })

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('1.3.0')
    })

    it('should set exact version', async () => {
      await executeCliCommand(['init', '--yes', '--name', 'Test Project'], { cwd: tempDir })

      const formPath = path.join(tempDir, 'form.json')
      await fs.writeFile(formPath, JSON.stringify({
        kind: 'form', name: 'test-form', title: 'Test', version: '1.0.0', fields: {},
      }))

      const result = await executeCliCommand(['version', formPath, '5.0.0'], { cwd: tempDir })

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('5.0.0')
    })

    it('should bump prerelease version', async () => {
      await executeCliCommand(['init', '--yes', '--name', 'Test Project'], { cwd: tempDir })

      const formPath = path.join(tempDir, 'form.json')
      await fs.writeFile(formPath, JSON.stringify({
        kind: 'form', name: 'test-form', title: 'Test', version: '1.0.0', fields: {},
      }))

      const result = await executeCliCommand(['version', formPath, 'premajor'], { cwd: tempDir })

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('2.0.0-0')
    })

    it('should fail for invalid bump type', async () => {
      await executeCliCommand(['init', '--yes', '--name', 'Test Project'], { cwd: tempDir })

      const formPath = path.join(tempDir, 'form.json')
      await fs.writeFile(formPath, JSON.stringify({
        kind: 'form', name: 'test-form', title: 'Test', version: '1.0.0', fields: {},
      }))

      const result = await executeCliCommand(['version', formPath, 'invalid'], { cwd: tempDir })

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('Invalid bump type')
    })

    it('should preserve YAML format', async () => {
      await executeCliCommand(['init', '--yes', '--name', 'Test Project'], { cwd: tempDir })

      const formPath = path.join(tempDir, 'form.yaml')
      await fs.writeFile(formPath, [
        'kind: form',
        'name: test-form',
        'title: Test',
        'version: 1.0.0',
        'fields: {}',
      ].join('\n'))

      const result = await executeCliCommand(['version', formPath, 'patch'], { cwd: tempDir })

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('1.0.1')

      // Verify file is still YAML
      const content = await fs.readFile(formPath, 'utf-8')
      expect(content).toContain('version:')
      expect(content).not.toContain('"version"')
    })

    it('should fail for nonexistent file', async () => {
      await executeCliCommand(['init', '--yes', '--name', 'Test Project'], { cwd: tempDir })

      const result = await executeCliCommand(['version', 'nonexistent.json', 'patch'], { cwd: tempDir })

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toMatch(/not found/i)
    })
  })
})

describe('CLI Utility Commands', () => {
  describe('docs command', () => {
    it('should display help for docs command', async () => {
      const result = await executeCliCommand(['docs', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('docs')
    })
  })

  describe('console command', () => {
    it('should display help for console command', async () => {
      const result = await executeCliCommand(['console', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('console')
    })
  })

  describe('apply command', () => {
    it('should display help for apply command', async () => {
      const result = await executeCliCommand(['apply', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('apply')
    })
  })
})
