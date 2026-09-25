import { describe, expect, it } from 'vitest'
import { detectFileDependencies } from '../../src/utils/project.js'

describe('paradoc-cli-226: bundle path items are file dependencies', () => {
  it('reports contents[].path items', () => {
    const bundle = { kind: 'bundle', name: 'packet', version: '1.0.0', contents: [
      { type: 'path', key: 'a', path: 'forms/a.yaml' },
      { type: 'registry', key: 'b', slug: '@acme/repo/b' },
    ] } as unknown as Parameters<typeof detectFileDependencies>[0]
    expect(detectFileDependencies(bundle)).toContain('forms/a.yaml')
  })
})
