import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PARADOC_SCHEMA_URL } from '@paradoc/schemas'
import { runCli } from '../setup/spawn-cli.js'

describe('paradoc-cli-012: detach protects layer references', () => {
  it('refuses a layer named by bindingsFrom and leaves the artifact unchanged', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'cli-012-'))
    const artifactPath = path.join(root, 'form.json')
    try {
      const source = `${JSON.stringify({
        $schema: PARADOC_SCHEMA_URL,
        kind: 'form',
        name: 'binding-layers',
        version: '1.0.0',
        fields: {},
        layers: {
          source: { kind: 'file', mimeType: 'application/pdf', path: 'source.pdf', bindings: {} },
          copy: { kind: 'file', mimeType: 'application/pdf', path: 'copy.pdf', bindingsFrom: 'source' },
        },
      }, null, 2)}\n`
      await writeFile(artifactPath, source)

      const result = await runCli(['detach', 'form.json', 'source', '-y'], { cwd: root })
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('layer "copy" names it in bindingsFrom')
      expect(await readFile(artifactPath, 'utf8')).toBe(source)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 30_000)
})
