import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { runCli } from '../setup/spawn-cli.js'
import { makeCompileFixture, SOURCE_YAML } from './registry-compile-helpers.js'

describe('paradoc-cli-004: compile preserves source files', () => {
  it('writes name.json without overwriting a catalogued YAML source', async () => {
    const root = await makeCompileFixture()
    try {
      const result = await runCli(['registry', 'compile'], { cwd: root })
      expect(result.exitCode).toBe(0)
      expect(await readFile(path.join(root, 'forms/w9.yaml'), 'utf8')).toBe(SOURCE_YAML)
      expect(JSON.parse(await readFile(path.join(root, 'w9.json'), 'utf8')).name).toBe('w9')
    } finally { await rm(root, { recursive: true, force: true }) }
  })
})
