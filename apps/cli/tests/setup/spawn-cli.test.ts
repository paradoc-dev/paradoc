import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { runCli } from './spawn-cli'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const packageVersion = (JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8')) as { version: string }).version

describe('shared CLI spawn helper', () => {
  it('runs the source and built entrypoints', async () => {
    await expect(runCli(['--version'], { target: 'source' })).resolves.toMatchObject({ stdout: 'dev\n', exitCode: 0 })
    await expect(runCli(['--version'], { target: 'dist' })).resolves.toMatchObject({
      stdout: `${packageVersion}\n`,
      exitCode: 0,
    })
  })
})
