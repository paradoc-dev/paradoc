import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function executeCliCommand(
  args: string[],
  options?: {
    cwd?: string
    env?: Record<string, string>
    timeout?: number
  }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const cliPath = path.resolve(__dirname, '../../src/index.ts')
    const child = spawn('tsx', [cliPath, ...args], {
      cwd: options?.cwd || process.cwd(),
      env: { ...process.env, ...options?.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    const timeout = options?.timeout || 30000
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`Command timed out after ${timeout}ms`))
    }, timeout)

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ stdout, stderr, exitCode: code ?? 0 })
    })

    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}

describe('CLI apply command', () => {
  it('should show help', async () => {
    const result = await executeCliCommand(['apply', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('--check')
    expect(result.stdout).toContain('--reverse')
    expect(result.stdout).toContain('--dry-run')
  })

  it('should fail outside a project or for non-existent patch file', async () => {
    const result = await executeCliCommand(['apply', '/tmp/nonexistent.patch'])

    expect(result.exitCode).toBe(1)
    // Fails with either "not found" (patch) or "Not an Paradoc repository" (no project)
    expect(result.stderr).toContain('Error')
  })

  describe('apply patches', () => {
    let tempDir: string

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paradoc-apply-test-'))
      // Initialize a project
      await executeCliCommand(['init', '--yes', '--name', 'apply-test'], { cwd: tempDir })
    })

    afterEach(async () => {
      try {
        await fs.rm(tempDir, { recursive: true, force: true })
      } catch {
        // Ignore
      }
    })

    it('should apply a valid unified diff patch', async () => {
      // Create original file
      const original = JSON.stringify({
        kind: 'form',
        name: 'my-form',
        version: '1.0.0',
        title: 'My Form',
        fields: {
          name: { type: 'text', label: 'Name', required: true },
        },
      }, null, 2)
      await fs.writeFile(path.join(tempDir, 'my-form.json'), original + '\n')

      // Create a patch that changes the version
      const patch = [
        '--- a/my-form.json',
        '+++ b/my-form.json',
        '@@ -2,4 +2,4 @@',
        '   "kind": "form",',
        '   "name": "my-form",',
        '-  "version": "1.0.0",',
        '+  "version": "2.0.0",',
        '   "title": "My Form",',
      ].join('\n') + '\n'

      const patchPath = path.join(tempDir, 'update.patch')
      await fs.writeFile(patchPath, patch)

      const result = await executeCliCommand(['apply', patchPath], { cwd: tempDir })

      expect(result.exitCode).toBe(0)

      // Verify the file was updated
      const content = await fs.readFile(path.join(tempDir, 'my-form.json'), 'utf-8')
      expect(content).toContain('"2.0.0"')
    })

    it('should check patch applicability with --check', async () => {
      const original = JSON.stringify({
        kind: 'form',
        name: 'my-form',
        version: '1.0.0',
        title: 'My Form',
        fields: {},
      }, null, 2)
      await fs.writeFile(path.join(tempDir, 'my-form.json'), original + '\n')

      const patch = [
        '--- a/my-form.json',
        '+++ b/my-form.json',
        '@@ -2,4 +2,4 @@',
        '   "kind": "form",',
        '   "name": "my-form",',
        '-  "version": "1.0.0",',
        '+  "version": "2.0.0",',
        '   "title": "My Form",',
      ].join('\n') + '\n'

      const patchPath = path.join(tempDir, 'check.patch')
      await fs.writeFile(patchPath, patch)

      const result = await executeCliCommand(['apply', patchPath, '--check'], { cwd: tempDir })

      expect(result.exitCode).toBe(0)

      // File should NOT be modified in check mode
      const content = await fs.readFile(path.join(tempDir, 'my-form.json'), 'utf-8')
      expect(content).toContain('"1.0.0"')
    })

    it('should preview changes with --dry-run', async () => {
      const original = JSON.stringify({
        kind: 'form',
        name: 'my-form',
        version: '1.0.0',
        title: 'My Form',
        fields: {},
      }, null, 2)
      await fs.writeFile(path.join(tempDir, 'my-form.json'), original + '\n')

      const patch = [
        '--- a/my-form.json',
        '+++ b/my-form.json',
        '@@ -2,4 +2,4 @@',
        '   "kind": "form",',
        '   "name": "my-form",',
        '-  "version": "1.0.0",',
        '+  "version": "2.0.0",',
        '   "title": "My Form",',
      ].join('\n') + '\n'

      const patchPath = path.join(tempDir, 'dry.patch')
      await fs.writeFile(patchPath, patch)

      const result = await executeCliCommand(['apply', patchPath, '--dry-run'], { cwd: tempDir })

      expect(result.exitCode).toBe(0)

      // File should NOT be modified in dry-run mode
      const content = await fs.readFile(path.join(tempDir, 'my-form.json'), 'utf-8')
      expect(content).toContain('"1.0.0"')
    })

    it('should fail when patch does not apply cleanly', async () => {
      // Create a file that doesn't match the patch context
      await fs.writeFile(
        path.join(tempDir, 'my-form.json'),
        JSON.stringify({ kind: 'form', name: 'different', version: '9.9.9', fields: {} }, null, 2) + '\n'
      )

      const patch = [
        '--- a/my-form.json',
        '+++ b/my-form.json',
        '@@ -1,3 +1,3 @@',
        ' {',
        '-  "kind": "document",',
        '+  "kind": "checklist",',
        '   "name": "something-else",',
      ].join('\n') + '\n'

      const patchPath = path.join(tempDir, 'bad.patch')
      await fs.writeFile(patchPath, patch)

      const result = await executeCliCommand(['apply', patchPath], { cwd: tempDir })

      expect(result.exitCode).toBe(1)
    })
  })
})
