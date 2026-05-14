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

describe('CLI diff command', () => {
  const fixture1 = path.join(fixturesDir, 'pet-addendum.yaml')
  const fixture2 = path.join(fixturesDir, 'pet-addendum-md.yaml')

  it('should show help', async () => {
    const result = await executeCliCommand(['diff', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('--name-only')
    expect(result.stdout).toContain('differences')
  })

  it('should report identical files', async () => {
    const result = await executeCliCommand(['diff', fixture1, fixture1])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('identical')
  })

  it('should show diff between two different files', async () => {
    const result = await executeCliCommand(['diff', fixture1, fixture2])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('---')
    expect(result.stdout).toContain('+++')
  })

  it('should support --name-only', async () => {
    const result = await executeCliCommand(['diff', fixture1, fixture2, '--name-only'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Files differ')
  })

  it('should fail for non-existent file', async () => {
    const result = await executeCliCommand(['diff', fixture1, '/tmp/nonexistent.yaml'])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('File not found')
  })
})
