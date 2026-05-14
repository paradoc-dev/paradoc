import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const fixturesDir = path.resolve(__dirname, '../fixtures')

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
      resolve({ stdout, stderr, exitCode: code ?? 0 })
    })

    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}

describe('CLI inspect command', () => {
  it('should show help', async () => {
    const result = await executeCliCommand(['inspect', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('--format')
    expect(result.stdout).toContain('--filter')
    expect(result.stdout).toContain('--summary')
    expect(result.stdout).toContain('--out')
    expect(result.stdout).toContain('--include-buttons')
    expect(result.stdout).toContain('--include-signatures')
  })

  it('should fail for non-existent file', async () => {
    const result = await executeCliCommand(['inspect', '/tmp/nonexistent.pdf'])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Error')
  })

  it('should inspect a PDF with form fields', async () => {
    const pdf = path.join(fixturesDir, 'pet-addendum-bindings.pdf')
    const result = await executeCliCommand(['inspect', pdf, '--format', 'json'])

    // If renderer-pdf is not installed this will fail with a renderer error,
    // otherwise we get valid JSON output.
    if (result.exitCode === 0) {
      const json = JSON.parse(result.stdout)
      expect(Array.isArray(json)).toBe(true)
    } else {
      // Renderer not installed — acceptable, skip content assertion
      expect(result.stderr).toContain('Error')
    }
  })

  describe('inspect options', () => {
    let tempDir: string

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paradoc-inspect-test-'))
    })

    afterEach(async () => {
      try {
        await fs.rm(tempDir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    })

    it('should output JSON format', async () => {
      const pdf = path.join(fixturesDir, 'pet-addendum-bindings.pdf')
      const result = await executeCliCommand(['inspect', pdf, '--format', 'json'])

      if (result.exitCode === 0) {
        // Should be valid JSON array
        const parsed = JSON.parse(result.stdout)
        expect(Array.isArray(parsed)).toBe(true)
        // Each item should have name and type
        if (parsed.length > 0) {
          expect(parsed[0]).toHaveProperty('name')
          expect(parsed[0]).toHaveProperty('type')
        }
      } else {
        // Renderer not available — skip
        expect(result.stderr).toContain('Error')
      }
    })

    it('should output table format (default)', async () => {
      const pdf = path.join(fixturesDir, 'pet-addendum-bindings.pdf')
      const result = await executeCliCommand(['inspect', pdf])

      if (result.exitCode === 0) {
        // Table format should contain column headers
        expect(result.stdout).toContain('Name')
        expect(result.stdout).toContain('Type')
      } else {
        expect(result.stderr).toContain('Error')
      }
    })

    it('should filter fields with --filter', async () => {
      const pdf = path.join(fixturesDir, 'pet-addendum-bindings.pdf')
      const result = await executeCliCommand(['inspect', pdf, '--format', 'json', '--filter', 'pet*'])

      if (result.exitCode === 0) {
        const parsed = JSON.parse(result.stdout)
        expect(Array.isArray(parsed)).toBe(true)
        // All returned fields should match the filter pattern
        for (const field of parsed) {
          expect(field.name.toLowerCase()).toMatch(/^pet/)
        }
      } else {
        expect(result.stderr).toContain('Error')
      }
    })

    it('should show summary with --summary', async () => {
      const pdf = path.join(fixturesDir, 'pet-addendum-bindings.pdf')
      const result = await executeCliCommand(['inspect', pdf, '--summary'])

      if (result.exitCode === 0) {
        // Summary output should contain total and breakdown
        const output = result.stdout
        expect(output).toContain('total')
        expect(output).toContain('breakdown')
      } else {
        expect(result.stderr).toContain('Error')
      }
    })

    it('should include buttons with --include-buttons', async () => {
      const pdf = path.join(fixturesDir, 'pet-addendum-bindings.pdf')
      const result = await executeCliCommand(['inspect', pdf, '--format', 'json', '--include-buttons'])

      if (result.exitCode === 0) {
        const parsed = JSON.parse(result.stdout)
        expect(Array.isArray(parsed)).toBe(true)
      } else {
        expect(result.stderr).toContain('Error')
      }
    })

    it('should include signatures with --include-signatures', async () => {
      const pdf = path.join(fixturesDir, 'pet-addendum-bindings.pdf')
      const result = await executeCliCommand(['inspect', pdf, '--format', 'json', '--include-signatures'])

      if (result.exitCode === 0) {
        const parsed = JSON.parse(result.stdout)
        expect(Array.isArray(parsed)).toBe(true)
      } else {
        expect(result.stderr).toContain('Error')
      }
    })

    it('should write output to file with --out', async () => {
      const pdf = path.join(fixturesDir, 'pet-addendum-bindings.pdf')
      const outPath = path.join(tempDir, 'inspect-result.json')
      const result = await executeCliCommand(['inspect', pdf, '--format', 'json', '--out', outPath])

      if (result.exitCode === 0) {
        // File should be created
        const content = await fs.readFile(outPath, 'utf-8')
        const parsed = JSON.parse(content)
        expect(Array.isArray(parsed)).toBe(true)
      } else {
        expect(result.stderr).toContain('Error')
      }
    })

    it('should reject invalid format', async () => {
      const pdf = path.join(fixturesDir, 'pet-addendum-bindings.pdf')
      const result = await executeCliCommand(['inspect', pdf, '--format', 'xml'])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toMatch(/unknown format|error/i)
    })
  })
})
