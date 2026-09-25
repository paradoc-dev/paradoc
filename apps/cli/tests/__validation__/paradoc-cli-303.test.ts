import { describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { assertNotSymlink, SymlinkError } from '../../src/utils/security.js'

describe('paradoc-cli-303', () => {
  it('rejects a dangling symlink', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'paradoc-303-'))
    const link = path.join(dir, 'layer.pdf')
    await fs.symlink(path.join(dir, 'missing.pdf'), link)
    await expect(assertNotSymlink(link)).rejects.toBeInstanceOf(SymlinkError)
    await fs.rm(dir, { recursive: true, force: true })
  })
})
