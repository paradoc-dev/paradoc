import { describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { makeProject, makeTempDir, runCli } from './__validation__/p1a-helpers'

const exists = (p: string) => fs.access(p).then(() => true, () => false)

describe('paradoc-cli-009: apply handles file-deletion patches', () => {
  it('deletes gone.txt for a `+++ /dev/null` patch', async () => {
    const dir = await makeTempDir('009a')
    await makeProject(dir)
    await fs.writeFile(path.join(dir, 'gone.txt'), 'bye\n')
    await fs.writeFile(path.join(dir, 'del.patch'), [
      'diff --git a/gone.txt b/gone.txt',
      'deleted file mode 100644',
      '--- a/gone.txt',
      '+++ /dev/null',
      '@@ -1 +0,0 @@',
      '-bye',
      '',
    ].join('\n'))
    const result = await runCli(['apply', 'del.patch'], { cwd: dir })
    console.log('apply deletion:', result.exitCode, result.stdout, result.stderr)
    expect(result.exitCode).toBe(0)
    expect(await exists(path.join(dir, 'gone.txt'))).toBe(false)
  }, 30000)

  it('control: --reverse of a new-file patch deletes the file (finding says this also fails)', async () => {
    const dir = await makeTempDir('009b')
    await makeProject(dir)
    await fs.writeFile(path.join(dir, 'new.txt'), 'hello\n')
    await fs.writeFile(path.join(dir, 'new.patch'), [
      'diff --git a/new.txt b/new.txt',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/new.txt',
      '@@ -0,0 +1 @@',
      '+hello',
      '',
    ].join('\n'))
    const result = await runCli(['apply', 'new.patch', '--reverse'], { cwd: dir })
    console.log('apply --reverse new-file:', result.exitCode, result.stdout, result.stderr)
    expect(result.exitCode).toBe(0)
    expect(await exists(path.join(dir, 'new.txt'))).toBe(false)
  }, 30000)
})
