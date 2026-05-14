import { describe, it, expect } from 'vitest'
import { spawn } from 'node:child_process'
import path from 'node:path'
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

describe('CLI hash command', () => {
  const fixture = path.join(fixturesDir, 'pet-addendum.yaml')

  it('should show help', async () => {
    const result = await executeCliCommand(['hash', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('checksum')
    expect(result.stdout).toContain('--json')
    expect(result.stdout).toContain('--algorithm')
  })

  it('should output a sha256 checksum', async () => {
    const result = await executeCliCommand(['hash', fixture])

    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  it('should output valid JSON with --json', async () => {
    const result = await executeCliCommand(['hash', fixture, '--json'])

    expect(result.exitCode).toBe(0)
    const json = JSON.parse(result.stdout)
    expect(json).toHaveProperty('checksum')
    expect(json).toHaveProperty('algorithm', 'sha256')
    expect(json).toHaveProperty('hash')
    expect(json).toHaveProperty('path')
    expect(json.checksum).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  it('should produce consistent hashes', async () => {
    const r1 = await executeCliCommand(['hash', fixture])
    const r2 = await executeCliCommand(['hash', fixture])

    expect(r1.stdout.trim()).toBe(r2.stdout.trim())
  })

  it('should fail for non-existent file', async () => {
    const result = await executeCliCommand(['hash', '/tmp/nonexistent-file.yaml'])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Error')
  })

  it('should fail for unsupported algorithm', async () => {
    const result = await executeCliCommand(['hash', fixture, '-a', 'md5'])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Unsupported algorithm')
  })
})
