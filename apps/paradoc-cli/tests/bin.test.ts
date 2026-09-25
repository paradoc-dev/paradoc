import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { runCli } from '../../cli/tests/setup/spawn-cli'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cliRoot = path.resolve(packageRoot, '../cli')

describe('paradoc-cli shim', () => {
  it('runs the built CLI and reports its version', async () => {
    await expect(runCli(['--version'], { target: 'shim' })).resolves.toMatchObject({ stdout: '0.5.0\n', exitCode: 0 })
  })

  it('imports the dist entry published by @paradoc/cli', () => {
    const manifest = JSON.parse(readFileSync(path.join(cliRoot, 'package.json'), 'utf8')) as { bin?: { paradoc?: string } }
    expect(manifest.bin?.paradoc).toBe('./dist/index.js')
    expect(readFileSync(path.join(packageRoot, 'bin.js'), 'utf8')).toContain("@paradoc/cli/dist/index.js")
    expect(existsSync(path.join(cliRoot, 'dist/index.js'))).toBe(true)
  })
})
