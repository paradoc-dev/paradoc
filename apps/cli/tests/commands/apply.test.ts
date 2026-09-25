import { runCli as executeCliCommand } from '../setup/spawn-cli'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

    const FILES = ['fileA.txt', 'fileB.txt', 'fileC.txt', 'fileD.txt', 'fileE.txt']
    const ORIGINAL = 'alpha\nbeta\ngamma\n'

    function multiFilePatch(files: string[]): string {
      return files
        .map((file) =>
          [
            `--- a/${file}`,
            `+++ b/${file}`,
            '@@ -1,3 +1,3 @@',
            ' alpha',
            '-beta',
            `+beta-${file}-changed`,
            ' gamma',
          ].join('\n')
        )
        .join('\n') + '\n'
    }

    async function readAll(files: string[]): Promise<string[]> {
      return Promise.all(files.map((file) => fs.readFile(path.join(tempDir, file), 'utf-8')))
    }

    it('should apply every file of a multi-file patch when all targets match', async () => {
      for (const file of FILES) await fs.writeFile(path.join(tempDir, file), ORIGINAL)
      const patchPath = path.join(tempDir, 'multi.patch')
      await fs.writeFile(patchPath, multiFilePatch(FILES))

      const result = await executeCliCommand(['apply', patchPath], { cwd: tempDir })

      expect(result.exitCode).toBe(0)
      const contents = await readAll(FILES)
      FILES.forEach((file, i) => {
        expect(contents[i]).toBe(`alpha\nbeta-${file}-changed\ngamma\n`)
      })
    })

    it('should write nothing and report every conflict when any target conflicts', async () => {
      for (const file of FILES) await fs.writeFile(path.join(tempDir, file), ORIGINAL)
      await fs.writeFile(path.join(tempDir, 'fileB.txt'), 'alpha\nDIVERGED-beta\ngamma\n')
      await fs.writeFile(path.join(tempDir, 'fileD.txt'), 'alpha\nDIVERGED-beta\ngamma\n')
      const patchPath = path.join(tempDir, 'multi.patch')
      await fs.writeFile(patchPath, multiFilePatch(FILES))

      const result = await executeCliCommand(['apply', patchPath], { cwd: tempDir })

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('2 conflict(s)')
      expect(result.stderr).toContain('fileB.txt')
      expect(result.stderr).toContain('fileD.txt')
      expect(result.stdout).toContain('No files were modified.')
      expect(result.stdout).not.toContain('Applied to')
      expect(await readAll(FILES)).toEqual([
        ORIGINAL,
        'alpha\nDIVERGED-beta\ngamma\n',
        ORIGINAL,
        'alpha\nDIVERGED-beta\ngamma\n',
        ORIGINAL,
      ])
    })

    it('should roll back files already written when a later write fails', async () => {
      await fs.writeFile(path.join(tempDir, 'fileA.txt'), ORIGINAL)
      // A regular file where the patch needs a directory makes the second write fail.
      await fs.writeFile(path.join(tempDir, 'blocker'), 'not a directory\n')
      const patch =
        multiFilePatch(['fileA.txt']) +
        ['--- /dev/null', '+++ b/blocker/new.txt', '@@ -0,0 +1 @@', '+created'].join('\n') +
        '\n'
      const patchPath = path.join(tempDir, 'rollback.patch')
      await fs.writeFile(patchPath, patch)

      const result = await executeCliCommand(['apply', patchPath], { cwd: tempDir })

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('rolled back')
      expect(await fs.readFile(path.join(tempDir, 'fileA.txt'), 'utf-8')).toBe(ORIGINAL)
      expect(await fs.readFile(path.join(tempDir, 'blocker'), 'utf-8')).toBe('not a directory\n')
    })

    it('should resolve a relative patch path against the invoking directory', async () => {
      await fs.writeFile(path.join(tempDir, 'fileA.txt'), ORIGINAL)
      const subdir = path.join(tempDir, 'subdir')
      await fs.mkdir(subdir)
      await fs.writeFile(path.join(subdir, 'my.patch'), multiFilePatch(['fileA.txt']))

      const result = await executeCliCommand(['apply', 'my.patch'], { cwd: subdir })

      expect(result.exitCode).toBe(0)
      expect(await fs.readFile(path.join(tempDir, 'fileA.txt'), 'utf-8')).toBe(
        'alpha\nbeta-fileA.txt-changed\ngamma\n'
      )
    })

    it('should not resolve a relative patch path against the repo root', async () => {
      await fs.writeFile(path.join(tempDir, 'fileA.txt'), ORIGINAL)
      await fs.writeFile(path.join(tempDir, 'root.patch'), multiFilePatch(['fileA.txt']))
      const subdir = path.join(tempDir, 'subdir')
      await fs.mkdir(subdir)

      const result = await executeCliCommand(['apply', 'root.patch'], { cwd: subdir })

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('Patch file not found: root.patch')
      expect(await fs.readFile(path.join(tempDir, 'fileA.txt'), 'utf-8')).toBe(ORIGINAL)
    })
  })
})
