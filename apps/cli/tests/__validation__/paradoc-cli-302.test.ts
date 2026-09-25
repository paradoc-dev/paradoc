import { describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCli } from '../setup/spawn-cli.js'

describe('paradoc-cli-302', () => {
  it('rejects using stdin for both artifact and data', async () => {
    const fixture = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/pet-addendum.yaml')
    const result = await runCli(['render', '-', '--data', '-'], { input: await fs.readFile(fixture, 'utf8') })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('stdin was already read by <artifact>')
  })
})
