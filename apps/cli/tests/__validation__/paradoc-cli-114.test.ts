import { describe, expect, it, vi } from 'vitest'

describe('paradoc-cli-114: renderer loading preserves real module errors', () => {
  it('does not install another copy when the package resolves but throws while loading', async () => {
    vi.doMock('@paradoc/react', () => {
      throw new Error('boom: top-level renderer failure')
    })

    const { rendererManager } = await import('../../src/utils/renderer-manager.js')
    const install = vi.spyOn(rendererManager, 'installRenderer')
    await expect(rendererManager.loadModule('@paradoc/react')).rejects.toThrow()
    expect(install).not.toHaveBeenCalled()
  })
})
