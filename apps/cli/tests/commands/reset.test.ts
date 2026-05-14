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

describe('CLI reset command', () => {
  describe('help', () => {
    it('should show available flags', async () => {
      const result = await executeCliCommand(['reset', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('--yes')
      expect(result.stdout).toContain('--keep-registries')
      expect(result.stdout).toContain('--keep-cache')
    })
  })

  describe('with --yes', () => {
    it('should reset to factory defaults', async () => {
      const result = await executeCliCommand(['reset', '--yes'])

      expect(result.exitCode).toBe(0)
      const output = result.stdout + result.stderr
      expect(output).toContain('reset to factory defaults')
    })

    it('should accept --keep-cache', async () => {
      const result = await executeCliCommand(['reset', '--yes', '--keep-cache'])

      expect(result.exitCode).toBe(0)
      const output = result.stdout + result.stderr
      expect(output).toContain('reset to factory defaults')
    })

    it('should accept --keep-registries', async () => {
      const result = await executeCliCommand(['reset', '--yes', '--keep-registries'])

      expect(result.exitCode).toBe(0)
      const output = result.stdout + result.stderr
      expect(output).toContain('reset to factory defaults')
    })
  })
})
