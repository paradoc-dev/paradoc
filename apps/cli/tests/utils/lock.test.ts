import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { LockFileManager } from '../../src/utils/lock.js'

describe('LockFileManager', () => {
  let manager: LockFileManager
  let tempDir: string

  beforeEach(async () => {
    manager = new LockFileManager()
    tempDir = await fs.mkdtemp(join(tmpdir(), 'paradoc-test-'))
  })

  afterEach(async () => {
    manager.reset()
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  describe('init and load', () => {
    it('creates empty lock file on init when none exists', async () => {
      await manager.init(tempDir)
      const artifacts = manager.listArtifacts()
      expect(artifacts).toEqual([])
    })

    it('loads existing lock file', async () => {
      // Create existing lock file
      const lockDir = join(tempDir, '.paradoc')
      await fs.mkdir(lockDir, { recursive: true })
      await fs.writeFile(
        join(lockDir, 'lock.json'),
        JSON.stringify({
          $schema: 'https://schema.paradoc.dev/lock.json',
          version: 1,
          artifacts: {
            '@acme/test-artifact': {
              kind: 'form',
              version: '1.0.0',
              resolved: 'https://registry.acme.com/r/test-artifact.json',
              integrity: 'sha256-abc123',
              installedAt: '2024-01-01T00:00:00Z',
              output: 'yaml',
              path: 'artifacts/@acme/test-artifact.yaml',
              layers: {},
            },
          },
        })
      )

      await manager.init(tempDir)
      expect(manager.isInstalled('@acme/test-artifact')).toBe(true)
    })
  })

  describe('artifact operations', () => {
    beforeEach(async () => {
      await manager.init(tempDir)
    })

    it('setArtifact adds artifact to lock file', () => {
      manager.setArtifact('@acme/my-form', {
        kind: 'form',
        version: '2.0.0',
        resolved: 'https://registry.acme.com/r/my-form.json',
        integrity: 'sha256-def456',
        output: 'json',
        path: 'artifacts/@acme/my-form.json',
        layers: {},
      })

      expect(manager.isInstalled('@acme/my-form')).toBe(true)
      const artifact = manager.getArtifact('@acme/my-form')
      expect(artifact?.version).toBe('2.0.0')
      expect(artifact?.output).toBe('json')
    })

    it('getArtifact returns null for non-existent artifact', () => {
      expect(manager.getArtifact('@acme/nonexistent')).toBeNull()
    })

    it('removeArtifact removes artifact', () => {
      manager.setArtifact('@acme/to-remove', {
        kind: 'checklist',
        version: '1.0.0',
        resolved: 'https://registry.acme.com/r/to-remove.json',
        integrity: 'sha256-ghi789',
        output: 'yaml',
        path: 'artifacts/@acme/to-remove.yaml',
        layers: {},
      })

      expect(manager.isInstalled('@acme/to-remove')).toBe(true)
      const removed = manager.removeArtifact('@acme/to-remove')
      expect(removed).toBe(true)
      expect(manager.isInstalled('@acme/to-remove')).toBe(false)
    })

    it('removeArtifact returns false for non-existent artifact', () => {
      expect(manager.removeArtifact('@acme/nonexistent')).toBe(false)
    })

    it('listArtifacts returns all artifacts', () => {
      manager.setArtifact('@acme/artifact1', {
        kind: 'form',
        version: '1.0.0',
        resolved: 'https://registry.acme.com/r/artifact1.json',
        integrity: 'sha256-111',
        output: 'yaml',
        path: 'artifacts/@acme/artifact1.yaml',
        layers: {},
      })
      manager.setArtifact('@acme/artifact2', {
        kind: 'document',
        version: '2.0.0',
        resolved: 'https://registry.acme.com/r/artifact2.json',
        integrity: 'sha256-222',
        output: 'json',
        path: 'artifacts/@acme/artifact2.json',
        layers: {},
      })

      const artifacts = manager.listArtifacts()
      expect(artifacts).toHaveLength(2)
      expect(artifacts.map((a) => a.ref)).toContain('@acme/artifact1')
      expect(artifacts.map((a) => a.ref)).toContain('@acme/artifact2')
    })

    it('getArtifactsByNamespace filters by namespace', () => {
      manager.setArtifact('@acme/artifact1', {
        kind: 'form',
        version: '1.0.0',
        resolved: 'https://registry.acme.com/r/artifact1.json',
        integrity: 'sha256-111',
        output: 'yaml',
        path: 'artifacts/@acme/artifact1.yaml',
        layers: {},
      })
      manager.setArtifact('@other/artifact2', {
        kind: 'bundle',
        version: '2.0.0',
        resolved: 'https://registry.other.com/r/artifact2.json',
        integrity: 'sha256-222',
        output: 'json',
        path: 'artifacts/@other/artifact2.json',
        layers: {},
      })

      const acmeArtifacts = manager.getArtifactsByNamespace('@acme')
      expect(acmeArtifacts).toHaveLength(1)
      expect(acmeArtifacts[0]?.ref).toBe('@acme/artifact1')
    })
  })

  describe('save', () => {
    it('saves lock file to disk', async () => {
      await manager.init(tempDir)
      manager.setArtifact('@acme/saved-artifact', {
        kind: 'form',
        version: '3.0.0',
        resolved: 'https://registry.acme.com/r/saved-artifact.json',
        integrity: 'sha256-saved',
        output: 'yaml',
        path: 'artifacts/@acme/saved-artifact.yaml',
        layers: {},
      })

      await manager.save()

      const lockPath = join(tempDir, '.paradoc', 'lock.json')
      const content = await fs.readFile(lockPath, 'utf-8')
      const parsed = JSON.parse(content)
      expect(parsed.artifacts['@acme/saved-artifact']).toBeDefined()
      expect(parsed.artifacts['@acme/saved-artifact'].version).toBe('3.0.0')
    })
  })

  describe('computeIntegrity', () => {
    it('computes SHA-256 integrity hash', () => {
      const integrity = manager.computeIntegrity('test content')
      expect(integrity).toMatch(/^sha256-.+/)
    })

    it('returns consistent hash for same content', () => {
      const hash1 = manager.computeIntegrity('identical content')
      const hash2 = manager.computeIntegrity('identical content')
      expect(hash1).toBe(hash2)
    })

    it('returns different hash for different content', () => {
      const hash1 = manager.computeIntegrity('content a')
      const hash2 = manager.computeIntegrity('content b')
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('createLockedArtifact', () => {
    it('creates locked artifact with computed integrity', () => {
      const content = JSON.stringify({ name: 'test' })
      const locked = manager.createLockedArtifact({
        kind: 'form',
        version: '1.0.0',
        resolved: 'https://example.com/artifact.json',
        content,
        output: 'json',
        path: 'artifacts/@test/artifact.json',
      })

      expect(locked.version).toBe('1.0.0')
      expect(locked.resolved).toBe('https://example.com/artifact.json')
      expect(locked.integrity).toMatch(/^sha256-.+/)
      expect(locked.output).toBe('json')
      expect(locked.path).toBe('artifacts/@test/artifact.json')
      expect(locked.layers).toEqual({})
    })

    it('creates locked artifact with layers', () => {
      const content = JSON.stringify({ name: 'test' })
      const layerContent = 'layer content'
      const locked = manager.createLockedArtifact({
        kind: 'document',
        version: '1.0.0',
        resolved: 'https://example.com/artifact.json',
        content,
        output: 'yaml',
        path: 'artifacts/@test/artifact.yaml',
        layers: {
          'default-template': { content: layerContent, path: 'layers/default.txt' },
        },
      })

      expect(locked.layers['default-template']).toBeDefined()
      expect(locked.layers['default-template']?.path).toBe('layers/default.txt')
      expect(locked.layers['default-template']?.integrity).toMatch(/^sha256-.+/)
    })
  })
})
