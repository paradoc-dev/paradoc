import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import path from 'node:path'
import { describe, expect, inject, it } from 'vitest'
import { paradocHomePath, userHomeDir } from '../../src/utils/home'

const root = inject('testHomeRoot')

function isUnderRoot(dir: string): boolean {
  const relative = path.relative(root, dir)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

describe('test home isolation', () => {
  it('points the test process at a temporary home', () => {
    expect(isUnderRoot(homedir())).toBe(true)
    expect(process.env.HOME).toBe(homedir())
    expect(process.env.USERPROFILE).toBe(homedir())
    expect(isUnderRoot(process.env.XDG_CONFIG_HOME ?? '')).toBe(true)
    expect(isUnderRoot(process.env.XDG_CACHE_HOME ?? '')).toBe(true)
  })

  it('resolves the CLI home and ~/.paradoc inside the temporary home', () => {
    expect(userHomeDir()).toBe(homedir())
    expect(isUnderRoot(paradocHomePath('config.json'))).toBe(true)
  })

  it('passes the temporary home to spawned processes', () => {
    const childHome = execFileSync(process.execPath, ['-e', 'process.stdout.write(require("os").homedir())'], {
      env: process.env,
      encoding: 'utf-8',
    })
    expect(isUnderRoot(childHome)).toBe(true)
  })

  it('does not treat a path outside the temporary root as isolated', () => {
    expect(isUnderRoot(path.dirname(root))).toBe(false)
    expect(isUnderRoot(root)).toBe(false)
  })
})

describe('userHomeDir', () => {
  it('follows a HOME change at call time', () => {
    const original = process.env.HOME
    const other = path.join(root, 'other-home')
    try {
      process.env.HOME = other
      expect(userHomeDir()).toBe(other)
      expect(paradocHomePath('cache')).toBe(path.join(other, '.paradoc', 'cache'))
    } finally {
      process.env.HOME = original
    }
    expect(userHomeDir()).toBe(original)
  })
})
