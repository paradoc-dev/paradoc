import { describe, expect, it, vi } from 'vitest'

vi.mock('node:path', async () => {
  const actual = await vi.importActual<typeof import('node:path')>('node:path')
  return { ...actual.win32, default: actual.win32 }
})

const { LocalFileSystem } = await import('../../src/utils/local-fs.js')

describe('framework-cli-seam-017', () => {
  const storage = new LocalFileSystem('C:\\proj')
  it('resolves relative and Windows absolute paths', () => {
    expect(storage.getAbsolutePath('forms\\a.json')).toBe('C:\\proj\\forms\\a.json')
    expect(storage.getAbsolutePath('D:\\forms\\a.json')).toBe('D:\\forms\\a.json')
    expect(storage.getAbsolutePath('C:\\other\\a.json')).toBe('C:\\other\\a.json')
    expect(storage.joinPath('C:\\proj', '.paradoc')).toBe('C:\\proj\\.paradoc')
  })
})
