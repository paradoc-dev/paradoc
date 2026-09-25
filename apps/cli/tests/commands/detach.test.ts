import { runCli as executeCliCommand } from '../setup/spawn-cli'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const fixturesDir = path.resolve(__dirname, '../fixtures')

describe('CLI detach command', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paradoc-detach-'))
    await fs.copyFile(
      path.join(fixturesDir, 'pet-addendum.yaml'),
      path.join(tmpDir, 'pet-addendum.yaml')
    )
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('should show help', async () => {
    const result = await executeCliCommand(['detach', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('--yes')
    expect(result.stdout).toContain('--dry-run')
  })

  it('should require layer name in non-interactive mode', async () => {
    const artifact = path.join(tmpDir, 'pet-addendum.yaml')
    const result = await executeCliCommand(['detach', artifact, '--yes'])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Target name required')
  })

  it('should fail for non-existent layer', async () => {
    const artifact = path.join(tmpDir, 'pet-addendum.yaml')
    const result = await executeCliCommand(['detach', artifact, 'nonexistent', '--yes'])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('not found')
  })

  it('should refuse to detach the default layer', async () => {
    const artifact = path.join(tmpDir, 'pet-addendum.yaml')
    const result = await executeCliCommand(['detach', artifact, 'default', '--yes'])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('defaultLayer')
  })

  it('should still protect the default layer during a dry run', async () => {
    const artifact = path.join(tmpDir, 'pet-addendum.yaml')
    const result = await executeCliCommand(['detach', artifact, 'default', '--yes', '--dry-run'])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('defaultLayer')
  })
})
