import { describe, expect, it } from 'vitest'
import { runCli } from './spawn-cli'

describe('shared CLI spawn helper', () => {
  it('runs the source and built entrypoints', async () => {
    await expect(runCli(['--version'], { target: 'source' })).resolves.toMatchObject({ stdout: 'dev\n', exitCode: 0 })
    await expect(runCli(['--version'], { target: 'dist' })).resolves.toMatchObject({ stdout: '0.6.0\n', exitCode: 0 })
  })
})
