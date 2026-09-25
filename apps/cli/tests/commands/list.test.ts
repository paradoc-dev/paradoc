import { runCli as executeCliCommand } from '../setup/spawn-cli'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('CLI list command', () => {
  it('should show help with --help', async () => {
    const result = await executeCliCommand(['list', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('--json')
    expect(result.stdout).toContain('--kind')
  })

  it('should support ls alias', async () => {
    const result = await executeCliCommand(['ls', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('List installed artifacts')
  })

  it('should fail outside a project', async () => {
    const result = await executeCliCommand(['list'], { cwd: os.tmpdir() })

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Not in a Paradoc project')
  })

  describe('list in a project', () => {
    let tempDir: string

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paradoc-list-test-'))
      // Initialize a project
      await executeCliCommand(['init', '--yes', '--name', 'list-test'], { cwd: tempDir })
    })

    afterEach(async () => {
      try {
        await fs.rm(tempDir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    })

    it('should show empty list in new project', async () => {
      const result = await executeCliCommand(['list'], { cwd: tempDir })

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('No artifacts installed')
    })

    it('should output empty JSON array for new project', async () => {
      const result = await executeCliCommand(['list', '--json'], { cwd: tempDir })

      expect(result.exitCode).toBe(0)
      const parsed = JSON.parse(result.stdout)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).toHaveLength(0)
    })

    it('should filter by kind with no results in empty project', async () => {
      const result = await executeCliCommand(['list', '--kind', 'form'], { cwd: tempDir })

      // --kind filter on empty project shows no artifacts
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('No artifacts installed')
    })

    it('should reject invalid --kind value', async () => {
      const result = await executeCliCommand(['list', '--kind', 'invalid'], { cwd: tempDir })

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('Invalid kind')
    })
  })
})
