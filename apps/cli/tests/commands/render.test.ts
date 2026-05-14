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

describe('CLI render command', () => {
  const fixture = path.join(fixturesDir, 'pet-addendum.yaml')

  it('should show help', async () => {
    const result = await executeCliCommand(['render', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('--out')
    expect(result.stdout).toContain('--layer')
    expect(result.stdout).toContain('--format')
    expect(result.stdout).toContain('--data')
    expect(result.stdout).toContain('--dry-run')
  })

  it('should render an inline layer to stdout', async () => {
    const result = await executeCliCommand(['render', fixture])

    expect(result.exitCode).toBe(0)
    // The pet-addendum has an inline markdown layer
    expect(result.stdout.length).toBeGreaterThan(0)
  })

  it('should support dry-run', async () => {
    const result = await executeCliCommand(['render', fixture, '--dry-run'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Dry run')
    expect(result.stdout).toContain('pet-addendum')
  })

  it('should support dry-run with --format json', async () => {
    const result = await executeCliCommand(['render', fixture, '--dry-run', '--format', 'json'])

    expect(result.exitCode).toBe(0)
    const json = JSON.parse(result.stdout)
    expect(json.mode).toBe('dry-run')
    expect(json.artifact.name).toBe('pet-addendum')
  })

  it('should fail for non-existent file', async () => {
    const result = await executeCliCommand(['render', '/tmp/nonexistent.yaml'])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Error')
  })

  describe('render with data', () => {
    let tempDir: string

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paradoc-render-test-'))
    })

    afterEach(async () => {
      try {
        await fs.rm(tempDir, { recursive: true, force: true })
      } catch {
        // Ignore
      }
    })

    it('should render with inline JSON data', async () => {
      const data = JSON.stringify({
        fields: {
          name: 'Rex',
          species: 'dog',
          weight: 30,
          hasVaccination: true,
        }
      })

      const result = await executeCliCommand(['render', fixture, '--data', data])

      expect(result.exitCode).toBe(0)
      // The rendered output should contain the substituted values
      expect(result.stdout).toContain('Rex')
    })

    it('should render with data from file', async () => {
      const dataPath = path.join(tempDir, 'data.json')
      await fs.writeFile(dataPath, JSON.stringify({
        fields: {
          name: 'Luna',
          species: 'cat',
          weight: 5,
          hasVaccination: false,
        }
      }))

      const result = await executeCliCommand(['render', fixture, '--data', dataPath])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Luna')
    })

    it('should write output to file with --out', async () => {
      const outPath = path.join(tempDir, 'output.md')

      const result = await executeCliCommand(['render', fixture, '--out', outPath])

      expect(result.exitCode).toBe(0)

      const content = await fs.readFile(outPath, 'utf-8')
      expect(content).toContain('Pet Addendum')
    })

    it('should specify layer with --layer', async () => {
      // pet-addendum.yaml has a 'default' layer
      const result = await executeCliCommand(['render', fixture, '--layer', 'default'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout.length).toBeGreaterThan(0)
    })

    it('should fail for nonexistent layer', async () => {
      const result = await executeCliCommand(['render', fixture, '--layer', 'nonexistent'])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toMatch(/not found|error/i)
    })
  })
})
