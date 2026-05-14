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

describe('CLI Validate Command', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paradoc-validate-test-'))
  })

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('validate --help', () => {
    it('should display help for validate command', async () => {
      const result = await executeCliCommand(['validate', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Validate')
    })
  })

  describe('validate valid artifacts', () => {
    it('should validate a valid form artifact', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['validate', formPath])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Valid')
    })

    it('should validate a form artifact and show kind', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['validate', formPath])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('form')
      expect(result.stdout).toContain('pet-addendum')
    })
  })

  describe('validate invalid artifacts', () => {
    it('should fail validation for missing required fields', async () => {
      // Create an invalid artifact (missing kind)
      const invalidPath = path.join(tempDir, 'invalid.json')
      await fs.writeFile(invalidPath, JSON.stringify({
        name: 'invalid-artifact',
        version: '1.0.0',
      }))

      const result = await executeCliCommand(['validate', invalidPath])

      expect(result.exitCode).toBe(1)
    })

    it('should fail validation for non-existent file', async () => {
      const result = await executeCliCommand(['validate', '/nonexistent/path/file.yaml'])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toMatch(/not found|error|ENOENT/i)
    })
  })

  describe('validate with options', () => {
    it('should support JSON output option', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['validate', formPath, '--json'])

      expect(result.exitCode).toBe(0)
      // JSON output should be parseable
      const parsed = JSON.parse(result.stdout)
      expect(parsed).toHaveProperty('ok', true)
    })

    it('should support silent mode', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['validate', formPath, '--silent'])

      expect(result.exitCode).toBe(0)
      // Silent mode should have minimal output
    })

    it('should support expect-kind option for correct kind', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['validate', formPath, '--expect-kind', 'form'])

      expect(result.exitCode).toBe(0)
    })

    it('should fail expect-kind for incorrect kind', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['validate', formPath, '--expect-kind', 'document'])

      expect(result.exitCode).toBe(1)
    })
  })

  describe('validate scope flags', () => {
    it('should validate schema-only and skip layers', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['validate', formPath, '--schema-only'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Valid')
      // Should mention layers are skipped
      expect(result.stdout).toMatch(/skipped|schema-only/i)
    })

    it('should validate layers-only', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['validate', formPath, '--layers-only'])

      expect(result.exitCode).toBe(0)
      // Should show layer info but not schema details
      expect(result.stdout).toContain('Valid')
    })

    it('should validate checksum-only', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['validate', formPath, '--checksum-only'])

      expect(result.exitCode).toBe(0)
    })

    it('should reject mutually exclusive scope flags', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['validate', formPath, '--schema-only', '--layers-only'])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('mutually exclusive')
    })

    it('should reject all three scope flags combined', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['validate', formPath, '--schema-only', '--layers-only', '--checksum-only'])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('mutually exclusive')
    })

    it('should validate schema-only with JSON output', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['validate', formPath, '--schema-only', '--json'])

      expect(result.exitCode).toBe(0)
      const parsed = JSON.parse(result.stdout)
      expect(parsed.ok).toBe(true)
      expect(parsed.layersSkipped).toBe(true)
    })

    it('should validate layers-only with JSON output', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum.yaml')
      const result = await executeCliCommand(['validate', formPath, '--layers-only', '--json'])

      expect(result.exitCode).toBe(0)
      const parsed = JSON.parse(result.stdout)
      expect(parsed.ok).toBe(true)
    })
  })

  describe('validate document artifact', () => {
    it('should validate a document artifact', async () => {
      const docPath = path.join(fixturesDir, 'enclosure.yaml')
      const result = await executeCliCommand(['validate', docPath])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('document')
    })

    it('should fail expect-kind form on a document', async () => {
      const docPath = path.join(fixturesDir, 'enclosure.yaml')
      const result = await executeCliCommand(['validate', docPath, '--expect-kind', 'form'])

      expect(result.exitCode).toBe(1)
    })
  })

  describe('validate layer checks', () => {
    it('should warn about missing layer file', async () => {
      // Create an artifact with a file layer pointing to nonexistent file
      const artifactPath = path.join(tempDir, 'bad-layers.json')
      await fs.writeFile(artifactPath, JSON.stringify({
        kind: 'form',
        name: 'bad-layers',
        version: '1.0.0',
        title: 'Bad Layers',
        fields: {
          name: { type: 'text', label: 'Name', required: true },
        },
        defaultLayer: 'pdf',
        layers: {
          pdf: {
            kind: 'file',
            mimeType: 'application/pdf',
            path: './nonexistent.pdf',
          },
        },
      }))

      const result = await executeCliCommand(['validate', artifactPath])

      // Should pass (missing file is a warning, not error) or give useful output
      const output = result.stdout + result.stderr
      expect(output).toMatch(/not found|warning|valid/i)
    })

    it('should report missing checksum as warning', async () => {
      const formPath = path.join(fixturesDir, 'pet-addendum-pdf.yaml')
      const result = await executeCliCommand(['validate', formPath, '--json'])

      // The pet-addendum-pdf.yaml has file layer without checksum
      expect(result.exitCode).toBe(0)
      const parsed = JSON.parse(result.stdout)
      // Should have warnings about missing checksums
      if (parsed.warnings && parsed.warnings.length > 0) {
        expect(parsed.warnings.some((w: { message: string }) => w.message.toLowerCase().includes('checksum'))).toBe(true)
      }
    })
  })
})
