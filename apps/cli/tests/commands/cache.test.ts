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

beforeEach(async () => {
  testHome = await fs.mkdtemp(path.join(tmpdir(), 'paradoc-home-'))
})

afterEach(async () => {
  await fs.rm(testHome, { recursive: true, force: true })
})

function executeCliCommand(args: string[], options: Parameters<typeof runCli>[1] = {}) {
  return runCli(args, { ...options, env: { HOME: testHome, ...options.env } })
}

describe('CLI cache command', () => {
  describe('help', () => {
    it('should list all sub-commands', async () => {
      const result = await executeCliCommand(['cache', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('clear')
      expect(result.stdout).toContain('stats')
      expect(result.stdout).toContain('config')
      expect(result.stdout).toContain('reset')
      expect(result.stdout).toContain('invalidate')
    })
  })

  describe('stats', () => {
    it('should output valid JSON with --json', async () => {
      const result = await executeCliCommand(['cache', 'stats', '--json'])

      expect(result.exitCode).toBe(0)
      const json = JSON.parse(result.stdout)
      expect(json).toHaveProperty('directory')
      expect(json).toHaveProperty('defaultTtl')
      expect(json).toHaveProperty('entries')
      expect(json).toHaveProperty('totalSize')
    })

    it('should show human-readable output', async () => {
      const result = await executeCliCommand(['cache', 'stats'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Cache Statistics')
    })

    it('reports the configured effective TTL without a session-entry field', async () => {
      await fs.mkdir(path.join(testHome, '.paradoc'), { recursive: true })
      await fs.writeFile(path.join(testHome, '.paradoc', 'config.json'), JSON.stringify({ cache: { ttl: 60 } }))

      const result = await executeCliCommand(['cache', 'stats', '--json'])
      const stats = JSON.parse(result.stdout)

      expect(stats.defaultTtl).toBe(60)
      expect(stats).not.toHaveProperty('sessionEntries')
    })

    it('should support info alias', async () => {
      const result = await executeCliCommand(['cache', 'info', '--json'])

      expect(result.exitCode).toBe(0)
      const json = JSON.parse(result.stdout)
      expect(json).toHaveProperty('directory')
      expect(json).toHaveProperty('defaultTtl')
    })
  })

  describe('config', () => {
    it('should output valid JSON with --json', async () => {
      const result = await executeCliCommand(['cache', 'config', '--json'])

      expect(result.exitCode).toBe(0)
      const json = JSON.parse(result.stdout)
      expect(json).toHaveProperty('directory')
      expect(json).toHaveProperty('global')
    })

    it('should show human-readable output', async () => {
      const result = await executeCliCommand(['cache', 'config'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Cache Configuration')
    })
  })

  describe('clear', () => {
    it('should succeed', async () => {
      const result = await executeCliCommand(['cache', 'clear'])

      expect(result.exitCode).toBe(0)
      const output = result.stdout + result.stderr
      expect(output).toMatch(/empty|Cleared/i)
    })
  })

  describe('reset', () => {
    it('should reset config to defaults', async () => {
      const result = await executeCliCommand(['cache', 'reset'])

      expect(result.exitCode).toBe(0)
      const output = result.stdout + result.stderr
      expect(output).toContain('reset to defaults')
    })

    it('should accept --clear flag', async () => {
      const result = await executeCliCommand(['cache', 'reset', '--clear'])

      expect(result.exitCode).toBe(0)
      const output = result.stdout + result.stderr
      expect(output).toContain('reset to defaults')
    })
  })

  describe('invalidate', () => {
    it('should fail without an argument', async () => {
      const result = await executeCliCommand(['cache', 'invalidate'])

      expect(result.exitCode).toBe(1)
    })

    it('reports no entry for the built-in @paradoc registry when nothing is cached', async () => {
      const result = await executeCliCommand(['cache', 'invalidate', '@paradoc'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout + result.stderr).toContain('No cache entry found for @paradoc')
    })

    it('fails for an unconfigured namespace, naming the add command', async () => {
      const result = await executeCliCommand(['cache', 'invalidate', '@nonexistent'])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('No registry is configured for @nonexistent. Run: paradoc registry add @nonexistent <url>')
    })
  })
})
