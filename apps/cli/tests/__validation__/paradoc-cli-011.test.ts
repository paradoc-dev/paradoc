import { describe, expect, inject, it } from 'vitest'
import { makeProject, makeTempDir, runCli } from './p1a-helpers'

const REGISTRY = inject('testRegistryUrl')

describe('paradoc-cli-011: registry view reads an artifact installed with --output ts', () => {
  it('shows @acme/lease-addendum after `add --output ts`', async () => {
    const dir = await makeTempDir('011')
    await makeProject(dir, { '@acme': { url: REGISTRY } })
    const add = await runCli(['add', '@acme/lease-addendum', '--output', 'ts', '--no-cache'], { cwd: dir })
    console.log('add:', add.exitCode, add.stdout)
    expect(add.exitCode).toBe(0)
    const view = await runCli(['registry', 'view', '@acme/lease-addendum'], { cwd: dir })
    console.log('view:', view.exitCode, view.stdout, view.stderr)
    expect(view.stderr).not.toContain('Could not read artifact file')
    expect(view.exitCode).toBe(0)
  }, 60000)

  it('control: view works for --output yaml', async () => {
    const dir = await makeTempDir('011c')
    await makeProject(dir, { '@acme': { url: REGISTRY } })
    await runCli(['add', '@acme/lease-addendum', '--output', 'yaml', '--no-cache'], { cwd: dir })
    const view = await runCli(['registry', 'view', '@acme/lease-addendum'], { cwd: dir })
    expect(view.exitCode).toBe(0)
  }, 60000)
})
