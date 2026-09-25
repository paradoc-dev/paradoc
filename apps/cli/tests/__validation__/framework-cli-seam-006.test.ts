import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  CONFIG_SCHEMA_ID,
  GlobalConfigSchema,
  IDENTIFIER_PATTERN,
  LOCK_SCHEMA_ID,
  MANIFEST_SCHEMA_ID,
  ManifestSchema,
  REGISTRY_SCHEMA_ID,
  SCHEMA_BASE,
} from '@paradoc/schemas'
import { describe, expect, it } from 'vitest'

const repo = path.resolve(import.meta.dirname, '../../../..')

function run(args: string[], cwd: string, home: string) {
  const result = spawnSync('pnpm', ['tsx', path.join(repo, 'apps/cli/src/index.ts'), ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, NO_COLOR: '1' },
  })
  return { exitCode: result.status, output: `${result.stdout}${result.stderr}` }
}

describe('framework-cli-seam-006: config sub-objects reject unknown keys', () => {
  it('rejects a misspelled global cache key through the CLI', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'seam006-'))
    const home = path.join(root, 'home')
    const work = path.join(root, 'work')
    mkdirSync(path.join(home, '.paradoc'), { recursive: true })
    mkdirSync(work, { recursive: true })
    writeFileSync(path.join(home, '.paradoc', 'config.json'), JSON.stringify({ cache: { tll: 0 } }))

    try {
      const result = run(['cache', 'stats'], work, home)
      expect(result.exitCode).toBe(1)
      expect(result.output).toContain('cache.tll')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('matches the published JSON Schemas for every affected sub-object', () => {
    const manifestJson = JSON.parse(readFileSync(path.join(repo, 'packages/schemas/schemas/manifest.json'), 'utf8'))
    const configJson = JSON.parse(readFileSync(path.join(repo, 'packages/schemas/schemas/config.json'), 'utf8'))
    expect(manifestJson.properties.artifacts.additionalProperties).toBe(false)
    expect(configJson.properties.cache.additionalProperties).toBe(false)

    const base = { $schema: 'https://schema.paradoc.dev/manifest.json', name: '@test/p', title: 'P', visibility: 'private' }
    const results = [
      ManifestSchema.safeParse({ ...base, artifacts: { format: 'yaml' } }),
      ManifestSchema.safeParse({ ...base, cache: { tll: 0 } }),
      ManifestSchema.safeParse({ ...base, registries: { '@a': { url: 'https://a.example.com', allowInsecure: true } } }),
      GlobalConfigSchema.safeParse({ cache: { tll: 0 } }),
      GlobalConfigSchema.safeParse({ registries: { '@a': { url: 'https://a.example.com', cache: { tll: 0 } } } }),
    ]
    expect(results.every((result) => !result.success)).toBe(true)
  })

  it('exports the shared identifier pattern and CLI schema addresses', () => {
    expect(IDENTIFIER_PATTERN.test('camelCase_2')).toBe(true)
    expect(IDENTIFIER_PATTERN.test('NotCamelCase')).toBe(false)
    expect([CONFIG_SCHEMA_ID, LOCK_SCHEMA_ID, MANIFEST_SCHEMA_ID, REGISTRY_SCHEMA_ID]).toEqual([
      `${SCHEMA_BASE}/config.json`,
      `${SCHEMA_BASE}/lock.json`,
      `${SCHEMA_BASE}/manifest.json`,
      `${SCHEMA_BASE}/registry.json`,
    ])
  })
})
