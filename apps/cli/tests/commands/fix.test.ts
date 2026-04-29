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

describe('CLI fix command', () => {
  const fixture = path.join(fixturesDir, 'pet-addendum.yaml')

  it('should show help', async () => {
    const result = await executeCliCommand(['fix', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('--yes')
    expect(result.stdout).toContain('--dry-run')
  })

  it('should report no changes needed for inline layers', async () => {
    const result = await executeCliCommand(['fix', fixture, '--yes'])

    expect(result.exitCode).toBe(0)
    const output = result.stdout + result.stderr
    // Inline-only artifact has no file-backed layers to fix
    expect(output).toMatch(/No (file-backed )?layers to fix|No changes needed|checksums are valid/i)
  })

  it('should support dry-run on a file-backed artifact', async () => {
    const pdfFixture = path.join(fixturesDir, 'pet-addendum-pdf.yaml')
    const result = await executeCliCommand(['fix', pdfFixture, '--dry-run', '--yes'])

    expect(result.exitCode).toBe(0)
    // Either "No changes needed" or "Dry run: No changes written"
    const output = result.stdout + result.stderr
    expect(output).toMatch(/No changes|Dry run/i)
  })

  it('should fail for non-existent file', async () => {
    const result = await executeCliCommand(['fix', '/tmp/nonexistent.yaml'])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Error')
  })
})
