import { runCli as executeCliCommand } from '../setup/spawn-cli'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('CLI init command', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paradoc-init-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('should show help with all options', async () => {
    const result = await executeCliCommand(['init', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('--name')
    expect(result.stdout).toContain('--yes')
    expect(result.stdout).toContain('--dry-run')
    expect(result.stdout).toContain('--visibility')
    expect(result.stdout).toContain('--nested')
  })

  it('should require --name in non-interactive mode', async () => {
    const result = await executeCliCommand(['init', '--yes'], { cwd: tmpDir })

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toContain('--name is required')
  })

  it('should initialize a project with --yes', async () => {
    const result = await executeCliCommand(
      ['init', '--yes', '--name', 'Test Project'],
      { cwd: tmpDir }
    )

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('initialized successfully')

    // Verify files were created
    const manifest = await fs.readFile(path.join(tmpDir, 'paradoc.json'), 'utf-8')
    expect(JSON.parse(manifest)).toHaveProperty('name')
  })

  it('should support dry-run', async () => {
    const result = await executeCliCommand(
      ['init', '--yes', '--name', 'Test Project', '--dry-run'],
      { cwd: tmpDir }
    )

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Dry run')

    // Verify no files were actually created
    const files = await fs.readdir(tmpDir)
    expect(files).not.toContain('paradoc.json')
  })

  it('should fail if paradoc.json already exists', async () => {
    // Create a project first
    await executeCliCommand(
      ['init', '--yes', '--name', 'First Project'],
      { cwd: tmpDir }
    )

    // Try to init again
    const result = await executeCliCommand(
      ['init', '--yes', '--name', 'Second Project'],
      { cwd: tmpDir }
    )

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toContain('already exists')
  })
})
