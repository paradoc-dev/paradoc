import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ConfigManager } from '../../src/utils/config.js'

describe('ConfigManager', () => {
  let tempDir: string
  let configManager: ConfigManager

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'paradoc-config-test-'))
    configManager = new ConfigManager()
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
})
