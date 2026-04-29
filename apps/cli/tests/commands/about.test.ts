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

describe('CLI about command', () => {
  it('should display full system information', async () => {
    const result = await executeCliCommand(['about'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Paradoc Manager')
    expect(result.stdout).toMatch(/Version:/)
    expect(result.stdout).toMatch(/Platform:/)
    expect(result.stdout).toMatch(/Node Version:/)
    expect(result.stdout).toMatch(/Working Dir:/)
  })

  it('should show a valid version number', async () => {
    const result = await executeCliCommand(['about'])

    expect(result.exitCode).toBe(0)
    // Version is either a semver or "dev"
    expect(result.stdout).toMatch(/Version:\s+(dev|\d+\.\d+\.\d+)/)
  })

  it('should show the current platform', async () => {
    const result = await executeCliCommand(['about'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain(process.platform)
  })

  it('should show the current node version', async () => {
    const result = await executeCliCommand(['about'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain(process.version)
  })
})
