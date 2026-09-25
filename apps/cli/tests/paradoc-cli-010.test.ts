import { describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { makeProject, makeTempDir, runCli, sampleForm } from './__validation__/p1a-helpers'

async function setup(prefix: string): Promise<{ dir: string; sub: string }> {
  const dir = await makeTempDir(prefix)
  await makeProject(dir)
  const sub = path.join(dir, 'sub')
  await fs.mkdir(sub)
  await fs.writeFile(path.join(sub, 'a.json'), JSON.stringify(sampleForm('a'), null, 2))
  await fs.writeFile(path.join(sub, 'b.json'), JSON.stringify({ ...sampleForm('a'), title: 'Changed' }, null, 2))
  return { dir, sub }
}

describe('paradoc-cli-010: diff and show resolve relative paths from the working directory', () => {
  it('diff finds a.json and b.json in <project>/sub', async () => {
    const { dir, sub } = await setup('010a')
    const result = await runCli(['diff', 'a.json', 'b.json'], { cwd: sub, home: path.join(dir, '.home') })
    console.log('diff:', result.exitCode, result.stdout, result.stderr)
    expect(result.stderr).not.toContain('File not found')
    expect(result.exitCode).toBe(1) // files differ
  }, 30000)

  it('show finds a.json in <project>/sub', async () => {
    const { dir, sub } = await setup('010b')
    const result = await runCli(['show', 'a.json'], { cwd: sub, home: path.join(dir, '.home') })
    console.log('show:', result.exitCode, result.stdout, result.stderr)
    expect(result.stderr).not.toContain('File not found')
    expect(result.exitCode).toBe(0)
  }, 30000)

  it('show reads the cwd file, not a same-named file at the project root', async () => {
    const { dir, sub } = await setup('010c')
    await fs.writeFile(path.join(dir, 'a.json'), JSON.stringify({ ...sampleForm('a'), title: 'Root Copy' }, null, 2))
    const result = await runCli(['show', 'a.json'], { cwd: sub, home: path.join(dir, '.home') })
    console.log('show (root copy present):', result.exitCode, result.stdout)
    expect(result.stdout).not.toContain('Root Copy')
    expect(result.stdout).toContain('Sample Form')
  }, 30000)
})
