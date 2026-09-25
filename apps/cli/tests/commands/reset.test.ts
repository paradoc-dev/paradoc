import { runCli } from '../setup/spawn-cli'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Every command runs against a throwaway home, never the real ~/.paradoc.
let testHome: string
const configPath = () => path.join(testHome, '.paradoc', 'config.json')
const writeConfig = async (content: string) => {
  await fs.mkdir(path.join(testHome, '.paradoc'), { recursive: true })
  await fs.writeFile(configPath(), content)
}

beforeEach(async () => {
  testHome = await fs.mkdtemp(path.join(tmpdir(), 'paradoc-home-'))
})

afterEach(async () => {
  await fs.rm(testHome, { recursive: true, force: true })
})

function executeCliCommand(args: string[], options: Parameters<typeof runCli>[1] = {}) {
  return runCli(args, { ...options, env: { HOME: testHome, ...options.env } })
}

describe('CLI reset command', () => {
  describe('help', () => {
    it('should show available flags', async () => {
      const result = await executeCliCommand(['reset', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('--yes')
      expect(result.stdout).toContain('--keep-registries')
      expect(result.stdout).toContain('--keep-cache')
      expect(result.stdout).toContain('--keep-renderers')
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

    it('clears the configured cache directory', async () => {
      const cacheDir = path.join(testHome, 'custom-cache')
      await writeConfig(JSON.stringify({ cache: { directory: cacheDir } }))
      await fs.mkdir(cacheDir, { recursive: true })
      await fs.writeFile(path.join(cacheDir, 'entry.json'), '{}')

      const result = await executeCliCommand(['reset', '--yes', '--keep-renderers'])

      expect(result.exitCode).toBe(0)
      expect(await fs.readdir(cacheDir).catch(() => [])).toEqual([])
    })
  })

  describe('global config', () => {
    const ANONYMOUS_ID = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b'

    it('keeps registries, the telemetry opt-out, and the anonymous ID with --keep-registries', async () => {
      const registries = { '@acme': { url: 'https://registry.acme.com', headers: { Authorization: 'Bearer ${ACME_TOKEN}' } } }
      await writeConfig(JSON.stringify({
        registries,
        cache: { ttl: 10 },
        telemetry: { enabled: false },
        anonymousId: ANONYMOUS_ID,
      }))

      const result = await executeCliCommand(['reset', '--yes', '--keep-cache', '--keep-registries'])

      expect(result.exitCode).toBe(0)
      const config = JSON.parse(await fs.readFile(configPath(), 'utf-8'))
      expect(config.registries).toEqual(registries)
      expect(config.telemetry).toEqual({ enabled: false })
      expect(config.anonymousId).toBe(ANONYMOUS_ID)
      expect(config.cache).toEqual({ ttl: 3600 })
    })

    it('stops on a malformed config, naming the file, and leaves it as it is', async () => {
      const malformed = '{ "registries": { "@acme": "https://registry.acme.com" }, "enableTelemetry": false }'
      await writeConfig(malformed)

      const result = await executeCliCommand(['reset', '--yes', '--keep-cache'])

      expect(result.exitCode).toBe(1)
      expect(result.stdout + result.stderr).toContain(configPath())
      expect(result.stdout + result.stderr).toContain('unknown key "enableTelemetry"')
      expect(await fs.readFile(configPath(), 'utf-8')).toBe(malformed)
    })
  })
})
