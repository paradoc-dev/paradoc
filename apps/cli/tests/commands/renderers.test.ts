import { describe, it, expect } from 'vitest'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

describe('CLI renderers command', () => {
  describe('help', () => {
    it('should list all sub-commands', async () => {
      const result = await executeCliCommand(['renderers', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('status')
      expect(result.stdout).toContain('install')
      expect(result.stdout).toContain('remove')
      expect(result.stdout).toContain('update')
    })
  })

  describe('status', () => {
    it('should output valid JSON with --json', async () => {
      const result = await executeCliCommand(['renderers', 'status', '--json'])

      expect(result.exitCode).toBe(0)
      const json = JSON.parse(result.stdout)
      expect(Array.isArray(json)).toBe(true)
      for (const entry of json) {
        expect(entry).toHaveProperty('name')
        expect(entry).toHaveProperty('expectedVersion')
        expect(entry).toHaveProperty('installed')
      }
    })

    it('should show human-readable output', async () => {
      const result = await executeCliCommand(['renderers', 'status'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Renderer plugins')
    })
  })

  describe('remove', () => {
    it('should remove all renderers when called without arguments', async () => {
      const result = await executeCliCommand(['renderers', 'remove'])

      expect(result.exitCode).toBe(0)
      const output = result.stdout + result.stderr
      expect(output).toContain('Removed all renderers')
    })
  })

  describe('install', () => {
    it('should fail for an unknown renderer name', async () => {
      const result = await executeCliCommand(['renderers', 'install', 'nonexistent'])

      expect(result.exitCode).toBe(1)
      const output = result.stdout + result.stderr
      expect(output).toContain('Unknown renderer')
    })
  })
})
