import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
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

describe('CLI detach command', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paradoc-detach-'))
    await fs.copyFile(
      path.join(fixturesDir, 'pet-addendum.yaml'),
      path.join(tmpDir, 'pet-addendum.yaml')
    )
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('should show help', async () => {
    const result = await executeCliCommand(['detach', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('--yes')
    expect(result.stdout).toContain('--dry-run')
  })

  it('should require layer name in non-interactive mode', async () => {
    const artifact = path.join(tmpDir, 'pet-addendum.yaml')
    const result = await executeCliCommand(['detach', artifact, '--yes'])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Target name required')
  })

  it('should fail for non-existent layer', async () => {
    const artifact = path.join(tmpDir, 'pet-addendum.yaml')
    const result = await executeCliCommand(['detach', artifact, 'nonexistent', '--yes'])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('not found')
  })

  it('should detach a layer with --yes', async () => {
    const artifact = path.join(tmpDir, 'pet-addendum.yaml')
    const result = await executeCliCommand(['detach', artifact, 'default', '--yes'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Detached')
  })

  it('should support dry-run', async () => {
    const artifact = path.join(tmpDir, 'pet-addendum.yaml')
    const result = await executeCliCommand(['detach', artifact, 'default', '--yes', '--dry-run'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Dry run')
  })
})
