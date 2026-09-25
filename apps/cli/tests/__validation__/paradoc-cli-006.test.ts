import { createHash } from 'node:crypto'
import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { runCli } from '../setup/spawn-cli.js'
import { makeCompileFixture } from './registry-compile-helpers.js'

describe('paradoc-cli-006: compile checksums content refs', () => {
  it('refreshes the instructions checksum', async () => {
    const root = await makeCompileFixture()
    try {
      expect((await runCli(['registry', 'compile', '--output', 'out'], { cwd: root })).exitCode).toBe(0)
      const artifact = JSON.parse(await readFile(path.join(root, 'out/w9.json'), 'utf8'))
      const bytes = await readFile(path.join(root, 'forms/instr.md'))
      expect(artifact.instructions.checksum).toBe(`sha256:${createHash('sha256').update(bytes).digest('hex')}`)
    } finally { await rm(root, { recursive: true, force: true }) }
  })
})
