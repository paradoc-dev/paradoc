import { describe, it, expect } from 'vitest'
import {
  parseArtifactRef,
  isValidArtifactRef,
  buildRegistryIndexUrl,
  buildArtifactItemUrl,
  buildLayerFileUrl,
} from '../../src/utils/registry.js'
import type { ResolvedRegistry } from '../../src/types.js'

describe('parseArtifactRef', () => {
  it('parses valid artifact references', () => {
    const result = parseArtifactRef('@acme/residential-lease')
    expect(result).toEqual({
      namespace: '@acme',
      name: 'residential-lease',
      full: '@acme/residential-lease',
    })
  })

  it('handles namespace with underscore', () => {
    const result = parseArtifactRef('@my_org/my_artifact')
    expect(result).toEqual({
      namespace: '@my_org',
      name: 'my_artifact',
      full: '@my_org/my_artifact',
    })
  })

  it('handles namespace with dash', () => {
    const result = parseArtifactRef('@my-org/my-artifact')
    expect(result).toEqual({
      namespace: '@my-org',
      name: 'my-artifact',
      full: '@my-org/my-artifact',
    })
  })

  it('returns null for missing @ prefix', () => {
    const result = parseArtifactRef('acme/residential-lease')
    expect(result).toBeNull()
  })

  it('returns null for missing slash', () => {
    const result = parseArtifactRef('@acme')
    expect(result).toBeNull()
  })

  it('returns null for empty name', () => {
    const result = parseArtifactRef('@acme/')
    expect(result).toBeNull()
  })

  it('returns null for empty namespace', () => {
    const result = parseArtifactRef('@/artifact')
    expect(result).toBeNull()
  })

  it('returns null for invalid namespace characters', () => {
    const result = parseArtifactRef('@acme!/artifact')
    expect(result).toBeNull()
  })

  it('returns null for empty string', () => {
    const result = parseArtifactRef('')
    expect(result).toBeNull()
  })
})

describe('isValidArtifactRef', () => {
  it('returns true for valid references', () => {
    expect(isValidArtifactRef('@acme/residential-lease')).toBe(true)
    expect(isValidArtifactRef('@paradoc/contact-form')).toBe(true)
    expect(isValidArtifactRef('@my_org/my_artifact_123')).toBe(true)
  })

  it('returns false for invalid references', () => {
    expect(isValidArtifactRef('acme/residential-lease')).toBe(false)
    expect(isValidArtifactRef('@acme')).toBe(false)
    expect(isValidArtifactRef('')).toBe(false)
  })
})

describe('buildRegistryIndexUrl', () => {
  it('builds correct URL for registry index', () => {
    const registry: ResolvedRegistry = {
      namespace: '@acme',
      baseUrl: 'https://registry.acme.com',
    }
    expect(buildRegistryIndexUrl(registry)).toBe('https://registry.acme.com/registry.json')
  })

  it('handles trailing slash in baseUrl', () => {
    const registry: ResolvedRegistry = {
      namespace: '@acme',
      baseUrl: 'https://registry.acme.com/',
    }
    expect(buildRegistryIndexUrl(registry)).toBe('https://registry.acme.com/registry.json')
  })
})

describe('buildArtifactItemUrl', () => {
  it('builds correct URL for artifact item', () => {
    const registry: ResolvedRegistry = {
      namespace: '@acme',
      baseUrl: 'https://registry.acme.com',
    }
    expect(buildArtifactItemUrl(registry, 'residential-lease')).toBe(
      'https://registry.acme.com/residential-lease.json'
    )
  })

  it('handles trailing slash in baseUrl', () => {
    const registry: ResolvedRegistry = {
      namespace: '@acme',
      baseUrl: 'https://registry.acme.com/',
    }
    expect(buildArtifactItemUrl(registry, 'my-form')).toBe(
      'https://registry.acme.com/my-form.json'
    )
  })

  it('uses artifactsPath when set', () => {
    const registry: ResolvedRegistry = {
      namespace: '@acme',
      baseUrl: 'https://registry.acme.com',
      artifactsPath: '/r',
    }
    expect(buildArtifactItemUrl(registry, 'residential-lease')).toBe(
      'https://registry.acme.com/r/residential-lease.json'
    )
  })

  it('uses itemPath when provided', () => {
    const registry: ResolvedRegistry = {
      namespace: '@acme',
      baseUrl: 'https://registry.acme.com',
    }
    expect(buildArtifactItemUrl(registry, 'my-form', 'custom/path/my-form.json')).toBe(
      'https://registry.acme.com/custom/path/my-form.json'
    )
  })
})

describe('buildLayerFileUrl', () => {
  it('builds correct URL for layer file', () => {
    const registry: ResolvedRegistry = {
      namespace: '@acme',
      baseUrl: 'https://registry.acme.com',
    }
    expect(buildLayerFileUrl(registry, 'layers/template.txt')).toBe(
      'https://registry.acme.com/layers/template.txt'
    )
  })

  it('handles file path with leading slash', () => {
    const registry: ResolvedRegistry = {
      namespace: '@acme',
      baseUrl: 'https://registry.acme.com',
    }
    expect(buildLayerFileUrl(registry, '/layers/template.txt')).toBe(
      'https://registry.acme.com/layers/template.txt'
    )
  })
})
