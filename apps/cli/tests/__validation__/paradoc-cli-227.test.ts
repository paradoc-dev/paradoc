import { describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { runCli } from '../setup/spawn-cli.js'
import { formatLayerCount, PROJECT_REQUIRED_MESSAGE } from '../../src/utils/user-copy.js'
import { createAboutCommand } from '../../src/commands/about.js'

describe('paradoc-cli-227: CLI user copy', () => {
  it('names both files required for a Paradoc project', () => {
    expect(PROJECT_REQUIRED_MESSAGE).toContain('paradoc.json')
    expect(PROJECT_REQUIRED_MESSAGE).toContain('.paradoc directory')
    expect(PROJECT_REQUIRED_MESSAGE).not.toContain('an Paradoc')
  })

  it('does not claim .paradoc is missing when only paradoc.json is absent', async () => {
    const cwd = mkdtempSync(path.join(tmpdir(), 'paradoc-cli-227-'))
    try {
      mkdirSync(path.join(cwd, '.paradoc'))
      writeFileSync(path.join(cwd, 'a.yaml'), 'kind: form\n')
      const result = await runCli(['version', 'a.yaml', 'patch'], { cwd })
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(PROJECT_REQUIRED_MESSAGE)
      expect(result.stderr).not.toContain('no .paradoc directory found')
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })

  it('identifies the about command as Paradoc CLI', () => {
    expect(createAboutCommand().description()).toBe('Display information about Paradoc CLI')
  })

  it('uses singular layer copy', () => {
    expect(formatLayerCount(1)).toBe('1 layer')
    expect(formatLayerCount(2)).toBe('2 layers')
  })
})
