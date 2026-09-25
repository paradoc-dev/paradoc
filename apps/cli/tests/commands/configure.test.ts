import { runCli as executeCliCommand } from '../setup/spawn-cli'
import { describe, it, expect } from 'vitest'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

  it('stops on a global config that still sets the removed defaults.registry', async () => {
    const home = await fs.mkdtemp(path.join(tmpdir(), 'paradoc-home-'))
    try {
      const configPath = path.join(home, '.paradoc', 'config.json')
      const stale = '{ "defaults": { "output": "json", "registry": "@paradoc" } }'
      await fs.mkdir(path.dirname(configPath), { recursive: true })
      await fs.writeFile(configPath, stale)

      const result = await executeCliCommand(['configure'], { env: { HOME: home } })

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('unknown key "defaults.registry"')
      expect(await fs.readFile(configPath, 'utf-8')).toBe(stale)
    } finally {
      await fs.rm(home, { recursive: true, force: true })
    }
  })
})
