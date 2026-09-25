import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { runCli } from '../setup/spawn-cli.js'

describe('paradoc-cli-007: compile fails when an item fails', () => {
  it('exits nonzero for a missing artifact', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'paradoc-registry-compile-'))
    try {
      await writeFile(path.join(root, 'registry.json'), JSON.stringify({ name: 'test', items: [{ name: 'ghost', kind: 'form', version: '1.0.0' }] }))
      const result = await runCli(['registry', 'compile'], { cwd: root })
      expect(result.stdout + result.stderr).toContain('ghost')
      expect(result.exitCode).toBe(1)
    } finally { await rm(root, { recursive: true, force: true }) }
  })
})
