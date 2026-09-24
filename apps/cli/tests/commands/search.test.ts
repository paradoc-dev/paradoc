import { describe, it, expect } from 'vitest'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'
import { unreachableNetworkEnv } from '../setup/unreachable-network.js'

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

describe('CLI search command', () => {
  it('should show help', async () => {
    const result = await executeCliCommand(['search', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('--registry')
    expect(result.stdout).toContain('--kind')
    expect(result.stdout).toContain('--tags')
    expect(result.stdout).toContain('--json')
  })

  it('fails for an unconfigured namespace, naming it and the add command', async () => {
    const result = await executeCliCommand(
      ['search', 'test', '--registry', '@nonexistent'],
      { cwd: os.tmpdir(), env: await unreachableNetworkEnv() }
    )

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('No registry is configured for @nonexistent. Run: paradoc registry add @nonexistent <url>')
  })

  it('searches @paradoc by default on a fresh install and names its host when it cannot be reached', async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), 'paradoc-search-home-'))
    try {
      const result = await executeCliCommand(['search', 'lease'], {
        cwd: home,
        env: { HOME: home, ...(await unreachableNetworkEnv()) },
      })

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('Cannot reach registry @paradoc at https://registry.paradoc.dev')
      expect(result.stderr).not.toContain('No registry is configured')
    } finally {
      await fs.rm(home, { recursive: true, force: true })
    }
  })

  it('rejects an invalid kind before contacting a registry', async () => {
    const result = await executeCliCommand(
      ['search', '--kind', 'invalid'],
      { cwd: os.tmpdir(), env: await unreachableNetworkEnv() }
    )

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Invalid kind: invalid')
    expect(result.stderr).not.toContain('Cannot reach')
  })
})
