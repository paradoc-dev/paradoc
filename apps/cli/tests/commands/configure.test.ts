import { describe, it, expect } from 'vitest'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
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

describe('CLI configure command', () => {
  it('should show help', async () => {
    const result = await executeCliCommand(['configure', '--help'])

    expect(result.exitCode).toBe(0)
    const output = result.stdout.toLowerCase()
    expect(output).toMatch(/wizard|configuration|configure/)
  })

  it('stops on a malformed global config, naming the file and key, and leaves it as it is', async () => {
    const home = await fs.mkdtemp(path.join(tmpdir(), 'paradoc-home-'))
    try {
      const configPath = path.join(home, '.paradoc', 'config.json')
      const malformed = '{ "registries": {}, "enableTelemetry": false }'
      await fs.mkdir(path.dirname(configPath), { recursive: true })
      await fs.writeFile(configPath, malformed)

      const result = await executeCliCommand(['configure'], { env: { HOME: home } })

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(configPath)
      expect(result.stderr).toContain('unknown key "enableTelemetry"')
      expect(result.stderr).not.toMatch(/\bat ConfigManager\./)
      expect(await fs.readFile(configPath, 'utf-8')).toBe(malformed)
    } finally {
      await fs.rm(home, { recursive: true, force: true })
    }
  })
})
