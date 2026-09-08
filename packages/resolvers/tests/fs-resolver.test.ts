import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { createFsResolver } from '@paradoc/resolvers/fs'

async function expectBytes(read: Promise<Uint8Array>, expected: Uint8Array): Promise<void> {
  expect(Array.from(await read)).toEqual(Array.from(expected))
}

describe('createFsResolver', () => {
  let sandbox: string
  let root: string
  let outside: string

  beforeEach(async () => {
    sandbox = await mkdtemp(join(tmpdir(), 'paradoc-resolver-'))
    root = join(sandbox, 'root')
    outside = join(sandbox, 'outside')
    await Promise.all([mkdir(join(root, 'nested'), { recursive: true }), mkdir(outside)])
    await Promise.all([
      writeFile(join(root, 'text.txt'), 'hello'),
      writeFile(join(root, 'empty.bin'), new Uint8Array()),
      writeFile(join(root, 'binary.bin'), new Uint8Array([0, 255, 1, 128])),
      writeFile(join(root, '..valid.txt'), 'valid'),
      writeFile(join(root, 'nested', 'inside.txt'), 'inside'),
      writeFile(join(outside, 'sentinel.txt'), 'outside'),
    ])
  })

  afterEach(async () => {
    await rm(sandbox, { recursive: true, force: true })
  })

  test('reads exact bytes with relative or one-leading-slash paths', async () => {
    const resolver = createFsResolver({ root })
    await expectBytes(resolver.read('text.txt'), new TextEncoder().encode('hello'))
    await expectBytes(resolver.read('/empty.bin'), new Uint8Array())
    await expectBytes(resolver.read('/binary.bin'), new Uint8Array([0, 255, 1, 128]))
  })

  test('accepts in-root dot segments and dot-prefixed filenames', async () => {
    const resolver = createFsResolver({ root })
    await expectBytes(resolver.read('nested/../..valid.txt'), new TextEncoder().encode('valid'))
  })

  test('observes fresh filesystem content', async () => {
    const resolver = createFsResolver({ root })
    await expectBytes(resolver.read('text.txt'), new TextEncoder().encode('hello'))
    await writeFile(join(root, 'text.txt'), 'updated')
    await expectBytes(resolver.read('text.txt'), new TextEncoder().encode('updated'))
  })

  test('rejects lexical traversal with a programmatic policy code', async () => {
    const resolver = createFsResolver({ root })
    await expect(resolver.read('../outside/sentinel.txt')).rejects.toMatchObject({ code: 'ERR_RESOLVER_OUTSIDE_ROOT' })
  })

  test('rejects outward file and directory symlinks', async () => {
    await symlink(join(outside, 'sentinel.txt'), join(root, 'outside-file'))
    await symlink(outside, join(root, 'outside-dir'))
    const resolver = createFsResolver({ root })
    await expect(resolver.read('outside-file')).rejects.toMatchObject({ code: 'ERR_RESOLVER_OUTSIDE_ROOT' })
    await expect(resolver.read('outside-dir/sentinel.txt')).rejects.toMatchObject({ code: 'ERR_RESOLVER_OUTSIDE_ROOT' })
  })

  test('supports in-root links and a symlinked root', async () => {
    await symlink(join(root, 'nested', 'inside.txt'), join(root, 'inside-link'))
    const rootLink = join(sandbox, 'root-link')
    await symlink(root, rootLink)
    const resolver = createFsResolver({ root: rootLink })
    await expectBytes(resolver.read('inside-link'), new TextEncoder().encode('inside'))
  })

  test.each(['', '\0', '//server/file', 'C:/file', 'nested\\inside.txt'])(
    'rejects malformed path %j',
    async (path) => {
      const resolver = createFsResolver({ root })
      await expect(resolver.read(path)).rejects.toMatchObject({ code: 'ERR_RESOLVER_INVALID_PATH' })
    },
  )

  test('preserves native errors for missing files and directories', async () => {
    const resolver = createFsResolver({ root })
    await expect(resolver.read('missing')).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(resolver.read('nested')).rejects.toMatchObject({ code: 'EISDIR' })
  })

  test('anchors a relative root when constructed', async () => {
    const originalCwd = process.cwd()
    const resolver = createFsResolver({ root: relative(originalCwd, root) })
    process.chdir(outside)
    try {
      await expectBytes(resolver.read('text.txt'), new TextEncoder().encode('hello'))
    } finally {
      process.chdir(originalCwd)
    }
  })
})
