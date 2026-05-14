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

describe('CLI attach command', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paradoc-attach-'))
    // Copy fixture artifact into temp dir so we can attach without modifying source
    await fs.copyFile(
      path.join(fixturesDir, 'pet-addendum.yaml'),
      path.join(tmpDir, 'pet-addendum.yaml')
    )
    // Create a dummy file to attach
    await fs.writeFile(path.join(tmpDir, 'readme.txt'), 'Hello world')
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('should show help', async () => {
    const result = await executeCliCommand(['attach', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('--yes')
    expect(result.stdout).toContain('--name')
    expect(result.stdout).toContain('--dry-run')
    expect(result.stdout).toContain('--mime-type')
  })

  it('should attach a file with --yes --dry-run', async () => {
    const artifact = path.join(tmpDir, 'pet-addendum.yaml')
    const file = path.join(tmpDir, 'readme.txt')
    const result = await executeCliCommand([
      'attach', artifact, file, '--yes', '--dry-run', '--name', 'readme',
    ])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Layer to add')
    expect(result.stdout).toContain('Dry run')
  })

  it('should attach a file non-interactively', async () => {
    const artifact = path.join(tmpDir, 'pet-addendum.yaml')
    const file = path.join(tmpDir, 'readme.txt')
    const result = await executeCliCommand([
      'attach', artifact, file, '--yes', '--name', 'readme',
    ])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Attached')
  })

  it('should fail for non-existent attachment file', async () => {
    const artifact = path.join(tmpDir, 'pet-addendum.yaml')
    const result = await executeCliCommand([
      'attach', artifact, '/tmp/nonexistent.pdf', '--yes',
    ])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('File not found')
  })
})
