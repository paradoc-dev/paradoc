import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ConfigManager } from '../../src/utils/config.js'
import { configAllowsTelemetry } from '../../src/utils/telemetry.js'

describe('ConfigManager', () => {
  let tempDir: string
  let configManager: ConfigManager

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'paradoc-config-test-'))
    configManager = new ConfigManager(tempDir)
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
    configManager.reset()
  })

  describe('getArtifactsDir', () => {
    it('returns default "artifacts" when no config specified', () => {
      expect(configManager.getArtifactsDir()).toBe('artifacts')
    })

    it('returns custom directory from project config', async () => {
      // Create project with custom artifacts dir
      await fs.writeFile(
        join(tempDir, 'paradoc.json'),
        JSON.stringify({
          $schema: 'https://schema.paradoc.dev/manifest.json',
          name: 'test-project',
          title: 'Test Project',
          visibility: 'private',
          artifacts: {
            dir: 'custom-artifacts',
          },
        })
      )

      await configManager.loadProjectManifest(tempDir)
      expect(configManager.getArtifactsDir()).toBe('custom-artifacts')
    })

    it('returns nested custom directory from project config', async () => {
      await fs.writeFile(
        join(tempDir, 'paradoc.json'),
        JSON.stringify({
          $schema: 'https://schema.paradoc.dev/manifest.json',
          name: 'test-project',
          title: 'Test Project',
          visibility: 'private',
          artifacts: {
            dir: 'src/paradoc/artifacts',
          },
        })
      )

      await configManager.loadProjectManifest(tempDir)
      expect(configManager.getArtifactsDir()).toBe('src/paradoc/artifacts')
    })

    it('project config takes precedence over global config', async () => {
      // Set up project with custom dir
      await fs.writeFile(
        join(tempDir, 'paradoc.json'),
        JSON.stringify({
          $schema: 'https://schema.paradoc.dev/manifest.json',
          name: 'test-project',
          title: 'Test Project',
          visibility: 'private',
          artifacts: {
            dir: 'project-artifacts',
          },
        })
      )

      await configManager.loadProjectManifest(tempDir)
      // Even if global config had different default, project takes precedence
      expect(configManager.getArtifactsDir()).toBe('project-artifacts')
    })
  })

  describe('getDefaultFormat', () => {
    it('returns default "json" when no config specified', () => {
      expect(configManager.getDefaultFormat()).toBe('json')
    })

    it('returns custom format from project config', async () => {
      await fs.writeFile(
        join(tempDir, 'paradoc.json'),
        JSON.stringify({
          $schema: 'https://schema.paradoc.dev/manifest.json',
          name: 'test-project',
          title: 'Test Project',
          visibility: 'private',
          artifacts: {
            output: 'json',
          },
        })
      )

      await configManager.loadProjectManifest(tempDir)
      expect(configManager.getDefaultFormat()).toBe('json')
    })
  })

  describe('registry configuration', () => {
    it('returns null for unconfigured namespace', async () => {
      await fs.writeFile(
        join(tempDir, 'paradoc.json'),
        JSON.stringify({
          $schema: 'https://schema.paradoc.dev/manifest.json',
          name: 'test-project',
          title: 'Test Project',
          visibility: 'private',
        })
      )

      await configManager.loadProjectManifest(tempDir)
      const registry = await configManager.getRegistry('@unknown')
      expect(registry).toBeNull()
    })

    it('returns simple URL registry', async () => {
      await fs.writeFile(
        join(tempDir, 'paradoc.json'),
        JSON.stringify({
          $schema: 'https://schema.paradoc.dev/manifest.json',
          name: 'test-project',
          title: 'Test Project',
          visibility: 'private',
          registries: {
            '@acme': 'https://registry.acme.com',
          },
        })
      )

      await configManager.loadProjectManifest(tempDir)
      const registry = await configManager.getRegistry('@acme')
      expect(registry).toBe('https://registry.acme.com')
    })

    it('returns registry with object config', async () => {
      await fs.writeFile(
        join(tempDir, 'paradoc.json'),
        JSON.stringify({
          $schema: 'https://schema.paradoc.dev/manifest.json',
          name: 'test-project',
          title: 'Test Project',
          visibility: 'private',
          registries: {
            '@local': {
              url: 'http://localhost:4567',
            },
          },
        })
      )

      await configManager.loadProjectManifest(tempDir)
      const registry = await configManager.getRegistry('@local')
      expect(registry).toEqual({
        url: 'http://localhost:4567',
      })
    })

    it('normalizes namespace with and without @ prefix', async () => {
      await fs.writeFile(
        join(tempDir, 'paradoc.json'),
        JSON.stringify({
          $schema: 'https://schema.paradoc.dev/manifest.json',
          name: 'test-project',
          title: 'Test Project',
          visibility: 'private',
          registries: {
            '@acme': 'https://registry.acme.com',
          },
        })
      )

      await configManager.loadProjectManifest(tempDir)

      // Should work with @ prefix
      expect(await configManager.getRegistry('@acme')).toBe('https://registry.acme.com')

      // Should also work without @ prefix
      expect(await configManager.getRegistry('acme')).toBe('https://registry.acme.com')
    })
  })

  describe('isInProject', () => {
    it('returns false when no project loaded', () => {
      expect(configManager.isInProject()).toBe(false)
    })

    it('returns true when project loaded', async () => {
      await fs.writeFile(
        join(tempDir, 'paradoc.json'),
        JSON.stringify({
          $schema: 'https://schema.paradoc.dev/manifest.json',
          name: 'test-project',
          title: 'Test Project',
          visibility: 'private',
        })
      )

      await configManager.loadProjectManifest(tempDir)
      expect(configManager.isInProject()).toBe(true)
    })

    it('returns false when paradoc.json does not exist', async () => {
      await configManager.loadProjectManifest(tempDir)
      expect(configManager.isInProject()).toBe(false)
    })
  })

  describe('project security settings', () => {
    const manifest = {
      $schema: 'https://schema.paradoc.dev/manifest.json',
      name: '@acme/forms',
      title: 'Acme forms',
      visibility: 'private',
      security: { allowedContentTypes: ['text/csv'] },
    }

    it('uses the project content types in place of the global ones', async () => {
      await fs.mkdir(join(tempDir, '.paradoc'))
      await fs.writeFile(
        join(tempDir, '.paradoc', 'config.json'),
        JSON.stringify({ security: { allowedContentTypes: ['text/x-global'] } }),
      )
      await fs.writeFile(join(tempDir, 'paradoc.json'), JSON.stringify(manifest))
      await configManager.loadProjectManifest(tempDir)

      const allowed = await configManager.getAllowedContentTypes()

      expect(allowed).toContain('text/csv')
      expect(allowed).not.toContain('text/x-global')
    })
  })

  describe('global config', () => {
    const ANONYMOUS_ID = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b'
    const savedConfig = {
      $schema: 'https://schema.paradoc.dev/config.json',
      registries: {
        '@acme': { url: 'https://registry.acme.com', headers: { Authorization: 'Bearer ${ACME_TOKEN}' } },
      },
      defaults: { output: 'yaml' as const, artifactsDir: 'forms' },
      cache: { ttl: 60, directory: '/tmp/paradoc-cache' },
      security: { allowedContentTypes: ['text/csv'] },
      telemetry: { enabled: false },
      anonymousId: ANONYMOUS_ID,
    }

    const configPath = () => join(tempDir, '.paradoc', 'config.json')
    const writeRaw = async (content: string) => {
      await fs.mkdir(join(tempDir, '.paradoc'), { recursive: true })
      await fs.writeFile(configPath(), content)
    }
    const readRaw = () => fs.readFile(configPath(), 'utf-8')

    it('loads a missing file as an empty config', async () => {
      expect(await configManager.loadGlobalConfig()).toEqual({})
    })

    it('keeps registries, telemetry, security, and the anonymous ID through save and reload', async () => {
      await configManager.saveGlobalConfig(savedConfig)

      const reloaded = new ConfigManager(tempDir)
      const config = await reloaded.loadGlobalConfig()
      expect(config.registries).toEqual(savedConfig.registries)
      expect(config.telemetry).toEqual({ enabled: false })
      expect(config.security).toEqual({ allowedContentTypes: ['text/csv'] })
      expect(config.anonymousId).toBe(ANONYMOUS_ID)
      expect(await reloaded.getRegistryUrl('@acme')).toBe('https://registry.acme.com')
      expect(await reloaded.getAllowedContentTypes()).toContain('text/csv')
    })

    it('keeps saved registries when a later command saves a telemetry-only change', async () => {
      await writeRaw(JSON.stringify(savedConfig))

      // What the next command does: load, change one key, save.
      const config = await configManager.loadGlobalConfig()
      config.telemetry = { enabled: true }
      await configManager.saveGlobalConfig(config)

      const onDisk = JSON.parse(await readRaw())
      expect(onDisk.registries).toEqual(savedConfig.registries)
      expect(onDisk.telemetry).toEqual({ enabled: true })
      expect(onDisk.anonymousId).toBe(ANONYMOUS_ID)
    })

    it('writes the canonical $schema address first', async () => {
      await configManager.saveGlobalConfig({ $schema: 'https://example.com/other.json', cache: { ttl: 5 } })
      const onDisk = JSON.parse(await readRaw())
      expect(Object.keys(onDisk)[0]).toBe('$schema')
      expect(onDisk.$schema).toBe('https://schema.paradoc.dev/config.json')
    })

    it('honors the documented telemetry opt-out', async () => {
      await writeRaw(JSON.stringify({ telemetry: { enabled: false } }))
      expect(configAllowsTelemetry(await configManager.loadGlobalConfig())).toBe(false)
    })

    it('allows telemetry when the config does not opt out', async () => {
      await writeRaw(JSON.stringify({ telemetry: { enabled: true } }))
      expect(configAllowsTelemetry(await configManager.loadGlobalConfig())).toBe(true)
      expect(configAllowsTelemetry({})).toBe(true)
    })

    it('fails on malformed JSON, naming the file, and leaves the file as it is', async () => {
      const malformed = '{ "registries": { "@acme": "https://registry.acme.com" }, '
      await writeRaw(malformed)

      await expect(configManager.loadGlobalConfig()).rejects.toThrow(`Invalid JSON in ${configPath()}`)
      await expect(configManager.setGlobalRegistry('@other', 'https://registry.other.com')).rejects.toThrow(configPath())
      expect(await readRaw()).toBe(malformed)
    })

    it('fails on unknown keys, naming the file and each key, and leaves the file as it is', async () => {
      const content = JSON.stringify({
        registries: { '@acme': 'https://registry.acme.com' },
        enableTelemetry: false,
        telemetry: { enabled: false, level: 'full' },
      })
      await writeRaw(content)

      const load = configManager.loadGlobalConfig()
      await expect(load).rejects.toThrow(`Invalid global config in ${configPath()}`)
      await expect(configManager.loadGlobalConfig()).rejects.toThrow(/unknown key "enableTelemetry"/)
      await expect(configManager.loadGlobalConfig()).rejects.toThrow(/unknown key "telemetry\.level"/)
      await expect(configManager.setGlobalCacheConfig({ ttl: 10 })).rejects.toThrow(configPath())
      expect(await readRaw()).toBe(content)
    })

    it('fails on an invalid value, naming its key', async () => {
      await writeRaw(JSON.stringify({ telemetry: { enabled: 'no' } }))
      await expect(configManager.loadGlobalConfig()).rejects.toThrow(/"telemetry\.enabled"/)
    })

    it('refuses to save an invalid config and writes nothing', async () => {
      await expect(
        configManager.saveGlobalConfig({ anonymousId: 'not-a-uuid' }),
      ).rejects.toThrow(`Refusing to write an invalid global config to ${configPath()}`)
      await expect(fs.access(configPath())).rejects.toThrow()
    })
  })
})
