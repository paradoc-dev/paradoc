import { describe, expect, inject, it } from 'vitest'
import { makeProject, makeTempDir, runCli } from './p1a-helpers'

const REGISTRY = inject('testRegistryUrl')

describe('paradoc-cli-003: add --output rejects unknown formats and never corrupts the lock', () => {
  it('rejects --output xml and leaves `paradoc list` working', async () => {
    const dir = await makeTempDir('003')
    await makeProject(dir, { '@acme': { url: REGISTRY } })
    const add = await runCli(['add', '@acme/lease-addendum', '--output', 'xml', '--no-cache'], { cwd: dir })
    console.log('add:', add.exitCode, add.stdout, add.stderr)
    const list = await runCli(['list'], { cwd: dir })
    console.log('list:', list.exitCode, list.stdout, list.stderr)
    const again = await runCli(['add', '@acme/w9', '--no-cache'], { cwd: dir })
    console.log('add again:', again.exitCode, again.stderr)
    expect(list.stderr).not.toContain('Invalid lock file')
    expect(list.exitCode).toBe(0)
    expect(add.exitCode).not.toBe(0)
  }, 60000)
})
