import { describe, it, expect } from 'vitest'
import { validateDownloadedArtifact } from '../../src/utils/security.js'

// framework-cli-seam-001: validateDownloadedArtifact's bundle check looks for
// `items`, but the real bundle schema (BundleObjectSchema, packages/schemas/
// src/zod/artifacts/bundle/index.ts) uses `contents`. A schema-valid bundle
// should not trigger a "no items defined" warning.
describe('framework-cli-seam-001 validateDownloadedArtifact bundle shape matches the schema', () => {
  it('does not warn about missing items for a schema-shaped bundle (uses contents, not items)', () => {
    const artifact = {
      name: 'test-bundle',
      kind: 'bundle',
      version: '1.0.0',
      title: 'Test Bundle',
      contents: [{ key: 'form1', ref: '@acme/form1' }],
    }
    const result = validateDownloadedArtifact(artifact)
    expect(result.warnings.some((w) => w.includes('items'))).toBe(false)
  })
})
