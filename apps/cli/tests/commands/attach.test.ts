import { runCli as executeCliCommand } from '../setup/spawn-cli'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const fixturesDir = path.resolve(__dirname, '../fixtures')

describe('CLI attach command', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paradoc-attach-'))
    // Copy fixture artifact into temp dir so we can attach without modifying source
    await fs.copyFile(
      path.join(fixturesDir, 'pet-addendum.yaml'),
      path.join(tmpDir, 'pet-addendum.yaml')
    )
    // Create a dummy file to attach
    await fs.writeFile(path.join(tmpDir, 'readme.txt'), 'Hello world')
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('should show help', async () => {
    const result = await executeCliCommand(['attach', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('--yes')
    expect(result.stdout).toContain('--name')
    expect(result.stdout).toContain('--dry-run')
    expect(result.stdout).toContain('--mime-type')
  })

  it('should attach a file with --yes --dry-run', async () => {
    const artifact = path.join(tmpDir, 'pet-addendum.yaml')
    const file = path.join(tmpDir, 'readme.txt')
    const result = await executeCliCommand([
      'attach', artifact, file, '--yes', '--dry-run', '--name', 'readme',
    ])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Layer to add')
    expect(result.stdout).toContain('Dry run')
  })

  it('should attach a file non-interactively', async () => {
    const artifact = path.join(tmpDir, 'pet-addendum.yaml')
    const file = path.join(tmpDir, 'readme.txt')
    const result = await executeCliCommand([
      'attach', artifact, file, '--yes', '--name', 'readme',
    ])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Attached')
  })

  it('should fail for non-existent attachment file', async () => {
    const artifact = path.join(tmpDir, 'pet-addendum.yaml')
    const result = await executeCliCommand([
      'attach', artifact, '/tmp/nonexistent.pdf', '--yes',
    ])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('File not found')
    expect(result.stderr).not.toContain('path traversal')
  })

  describe('file outside the artifact directory', () => {
    let artifactDir: string
    let outsideFile: string

    beforeEach(async () => {
      artifactDir = path.join(tmpDir, 'project')
      await fs.mkdir(artifactDir)
      await fs.rename(
        path.join(tmpDir, 'pet-addendum.yaml'),
        path.join(artifactDir, 'pet-addendum.yaml')
      )
      outsideFile = path.join(tmpDir, 'readme.txt')
    })

    it('names the containment rule and the fix for an absolute path', async () => {
      const artifact = path.join(artifactDir, 'pet-addendum.yaml')
      const before = await fs.readFile(artifact, 'utf-8')
      const result = await executeCliCommand(['attach', artifact, outsideFile, '--yes'])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain(`Cannot attach ${outsideFile}: it is outside the artifact's directory`)
      expect(result.stderr).toContain('Copy the file there first')
      expect(result.stderr).not.toContain('path traversal')
      expect(await fs.readFile(artifact, 'utf-8')).toBe(before)
    })

    it('names the containment rule for a relative ../ path', async () => {
      const result = await executeCliCommand(
        ['attach', 'pet-addendum.yaml', '../readme.txt', '--yes'],
        { cwd: artifactDir }
      )

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain("it is outside the artifact's directory")
    })

    it('checks the file the cwd-relative path names, not the same path under the artifact directory', async () => {
      // Resolved against the artifact directory this name would look inside;
      // resolved against cwd, as the CLI reads it, it is outside
      await fs.writeFile(path.join(tmpDir, 'project-readme.txt'), 'outside')

      const result = await executeCliCommand(
        ['attach', 'project/pet-addendum.yaml', 'project-readme.txt', '--yes'],
        { cwd: tmpDir }
      )

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain("it is outside the artifact's directory")
    })

    it('attaches a cwd-relative path that resolves inside the artifact directory', async () => {
      await fs.writeFile(path.join(artifactDir, 'inside.txt'), 'inside')
      const result = await executeCliCommand(
        ['attach', 'project/pet-addendum.yaml', 'project/inside.txt', '--yes', '--name', 'inside'],
        { cwd: tmpDir }
      )

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Attached')
      expect(await fs.readFile(path.join(artifactDir, 'pet-addendum.yaml'), 'utf-8')).toContain('inside.txt')
    })
  })

  it('rejects a directory with a message that says it is a directory', async () => {
    const artifact = path.join(tmpDir, 'pet-addendum.yaml')
    await fs.mkdir(path.join(tmpDir, 'assets'))
    const result = await executeCliCommand(['attach', artifact, path.join(tmpDir, 'assets'), '--yes'])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('it is a directory')
    expect(result.stderr).not.toContain('path traversal')
  })
})
