/**
 * resolvers-002: a root that is missing at the first read must not poison later reads.
 * Input: createFsResolver({ root }) with root missing; read('x.txt') (rejects ENOENT);
 * then create root and root/x.txt; read('x.txt') again.
 * Expected: second read resolves to the file bytes ("hi").
 * Actual (screened commit): the cached rejected realpath promise makes the second read reject with ENOENT.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { createFsResolver } from '../../src/fs/index'

let sandbox: string | undefined

afterEach(async () => {
  if (sandbox) await rm(sandbox, { recursive: true, force: true })
  sandbox = undefined
})

describe('resolvers-002', () => {
  test('read succeeds after a missing root is created', async () => {
    sandbox = await mkdtemp(join(tmpdir(), 'resolvers-002-'))
    const root = join(sandbox, 'root')
    const resolver = createFsResolver({ root })

    await expect(resolver.read('x.txt')).rejects.toMatchObject({ code: 'ENOENT' })

    await mkdir(root)
    await writeFile(join(root, 'x.txt'), 'hi')

    const bytes = await resolver.read('x.txt')
    expect(new TextDecoder().decode(bytes)).toBe('hi')
  })
})
