import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PARADOC_SCHEMA_URL } from '@paradoc/schemas'
import { runCli } from '../setup/spawn-cli.js'

describe('framework-cli-seam-002: attach layer identifiers', () => {
  it('derives camelCase names and rejects invalid explicit names before writing', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'cli-seam-002-'))
    const artifactPath = path.join(root, 'form.json')
    try {
      await writeFile(artifactPath, `${JSON.stringify({
        $schema: PARADOC_SCHEMA_URL,
        kind: 'form',
        name: 'attach-names',
        version: '1.0.0',
        fields: {},
      }, null, 2)}\n`)
      await writeFile(path.join(root, 'client-copy.tsx'), 'export default null\n')

      const derived = await runCli(['attach', 'form.json', 'client-copy.tsx', '-y'], { cwd: root })
      expect(derived.exitCode).toBe(0)
      expect(JSON.parse(await readFile(artifactPath, 'utf8')).layers.clientCopy).toMatchObject({ mimeType: 'text/tsx' })

      const before = await readFile(artifactPath, 'utf8')
      const invalid = await runCli(['attach', 'form.json', 'client-copy.tsx', '-y', '--name', 'Not-valid'], { cwd: root })
      expect(invalid.exitCode).toBe(1)
      expect(invalid.stderr).toContain('camelCase')
      expect(await readFile(artifactPath, 'utf8')).toBe(before)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 30_000)
})
