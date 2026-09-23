import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  peerDependencies?: Record<string, string>
  dependencies?: Record<string, string>
}

const siblings = (section: Record<string, string> = {}) =>
  Object.entries(section).filter(([name]) => name.startsWith('@paradoc/'))

describe('package manifest', () => {
  // Packages release in lockstep. A literal range goes stale when the release
  // bumps only `version`; the workspace protocol makes pnpm publish write the
  // released version into the published manifest.
  it('peers on sibling @paradoc packages through the workspace protocol', () => {
    const peers = siblings(manifest.peerDependencies)
    expect(peers.map(([name]) => name)).toContain('@paradoc/types')
    for (const [name, range] of peers) expect({ name, range }).toEqual({ name, range: 'workspace:^' })
  })

  it('depends on sibling @paradoc packages through the workspace protocol', () => {
    for (const [name, range] of siblings(manifest.dependencies)) expect({ name, range }).toEqual({ name, range: 'workspace:^' })
  })
})
