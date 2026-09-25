import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { runCli } from '../setup/spawn-cli.js'

const root = mkdtempSync(path.join(tmpdir(), 'paradoc-cli-133-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('paradoc-cli-133: validate reports read errors once', () => {
  it('writes one missing-file error to stderr', async () => {
    const result = await runCli(['validate', 'nope.json'], { cwd: root })
    expect(result.exitCode).toBe(1)
    expect(result.stdout + result.stderr).toMatch(/File not found: nope\.json/)
    expect((result.stdout + result.stderr).match(/File not found: nope\.json/g)).toHaveLength(1)
    expect(result.stdout).not.toContain('File not found')
  })
})
