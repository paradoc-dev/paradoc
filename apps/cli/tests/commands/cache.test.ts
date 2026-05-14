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

describe('CLI cache command', () => {
  describe('help', () => {
    it('should list all sub-commands', async () => {
      const result = await executeCliCommand(['cache', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('clear')
      expect(result.stdout).toContain('stats')
      expect(result.stdout).toContain('config')
      expect(result.stdout).toContain('reset')
      expect(result.stdout).toContain('invalidate')
    })
  })

  describe('stats', () => {
    it('should output valid JSON with --json', async () => {
      const result = await executeCliCommand(['cache', 'stats', '--json'])

      expect(result.exitCode).toBe(0)
      const json = JSON.parse(result.stdout)
      expect(json).toHaveProperty('directory')
      expect(json).toHaveProperty('defaultTtl')
      expect(json).toHaveProperty('entries')
      expect(json).toHaveProperty('totalSize')
    })

    it('should show human-readable output', async () => {
      const result = await executeCliCommand(['cache', 'stats'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Cache Statistics')
    })

    it('should support info alias', async () => {
      const result = await executeCliCommand(['cache', 'info', '--json'])

      expect(result.exitCode).toBe(0)
      const json = JSON.parse(result.stdout)
      expect(json).toHaveProperty('directory')
      expect(json).toHaveProperty('defaultTtl')
    })
  })

  describe('config', () => {
    it('should output valid JSON with --json', async () => {
      const result = await executeCliCommand(['cache', 'config', '--json'])

      expect(result.exitCode).toBe(0)
      const json = JSON.parse(result.stdout)
      expect(json).toHaveProperty('directory')
      expect(json).toHaveProperty('global')
    })

    it('should show human-readable output', async () => {
      const result = await executeCliCommand(['cache', 'config'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Cache Configuration')
    })
  })

  describe('clear', () => {
    it('should succeed', async () => {
      const result = await executeCliCommand(['cache', 'clear'])

      expect(result.exitCode).toBe(0)
      const output = result.stdout + result.stderr
      expect(output).toMatch(/empty|Cleared/i)
    })
  })

  describe('reset', () => {
    it('should reset config to defaults', async () => {
      const result = await executeCliCommand(['cache', 'reset'])

      expect(result.exitCode).toBe(0)
      const output = result.stdout + result.stderr
      expect(output).toContain('reset to defaults')
    })

    it('should accept --clear flag', async () => {
      const result = await executeCliCommand(['cache', 'reset', '--clear'])

      expect(result.exitCode).toBe(0)
      const output = result.stdout + result.stderr
      expect(output).toContain('reset to defaults')
    })
  })

  describe('invalidate', () => {
    it('should fail without an argument', async () => {
      const result = await executeCliCommand(['cache', 'invalidate'])

      expect(result.exitCode).toBe(1)
    })

    it('should report no entry for a non-existent namespace', async () => {
      const result = await executeCliCommand(['cache', 'invalidate', '@nonexistent'])

      expect(result.exitCode).toBe(0)
      const output = result.stdout + result.stderr
      expect(output).toContain('No cache entry found')
    })
  })
})
