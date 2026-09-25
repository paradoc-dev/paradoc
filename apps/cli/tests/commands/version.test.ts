import { runCli } from '../setup/spawn-cli'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PARADOC_SCHEMA_URL } from '@paradoc/schemas'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
let root: string
let repo: string
let home: string

function runVersion(args: string[]) {
  return runCli(['version', ...args], {
    cwd: repo,
    timeout: 30000,
    env: {
      HOME: home,
      XDG_CONFIG_HOME: path.join(home, '.config'),
      XDG_DATA_HOME: path.join(home, '.local', 'share'),
      XDG_CACHE_HOME: path.join(home, '.cache'),
      PARADOC_TELEMETRY_DISABLED: '1',
      NO_COLOR: '1',
    },
  })
}

function writeForm(version: string): string {
  const file = path.join(repo, 'my-form.json')
  fs.writeFileSync(file, `${JSON.stringify({ $schema: PARADOC_SCHEMA_URL, kind: 'form', name: 'my-form', version, fields: {} }, null, 2)}\n`)
  return file
}

function readVersion(file: string): string {
  return JSON.parse(fs.readFileSync(file, 'utf-8')).version
}

describe('CLI version command', () => {
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'paradoc-version-'))
    repo = path.join(root, 'repo')
    home = path.join(root, 'home')
    fs.mkdirSync(path.join(repo, '.paradoc'), { recursive: true })
    fs.mkdirSync(home)
    fs.writeFileSync(path.join(repo, 'paradoc.json'), '{}\n')
  })

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('bumps a prerelease version again', async () => {
    const file = writeForm('1.0.0')

    const first = await runVersion(['my-form.json', 'prerelease'])
    expect(first.exitCode).toBe(0)
    expect(readVersion(file)).toBe('1.0.1-0')

    const second = await runVersion(['my-form.json', 'prerelease'])
    expect(second.exitCode).toBe(0)
    expect(readVersion(file)).toBe('1.0.1-1')
  }, 60000)

  it('sets an explicit prerelease version', async () => {
    const file = writeForm('1.0.0')

    const result = await runVersion(['my-form.json', '2.0.0-rc.1'])
    expect(result.exitCode).toBe(0)
    expect(readVersion(file)).toBe('2.0.0-rc.1')
  })

  it('refuses an explicit version that is not SemVer and leaves the file unchanged', async () => {
    const file = writeForm('1.0.0')

    const result = await runVersion(['my-form.json', 'v2.0.0'])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Invalid bump type: v2.0.0')
    expect(readVersion(file)).toBe('1.0.0')
  })
})
