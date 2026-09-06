import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { findRepoRoot } from '../../src/utils/project.js'

describe('findRepoRoot', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'paradoc-project-test-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('finds a directory that carries both .paradoc and paradoc.json', async () => {
    await fs.mkdir(join(tempDir, '.paradoc'))
    await fs.writeFile(join(tempDir, 'paradoc.json'), '{}')

    expect(await findRepoRoot(tempDir)).toBe(tempDir)
  })

  it('walks up from a nested directory to find the project root', async () => {
    await fs.mkdir(join(tempDir, '.paradoc'))
    await fs.writeFile(join(tempDir, 'paradoc.json'), '{}')
    const nested = join(tempDir, 'compositions', 'deep')
    await fs.mkdir(nested, { recursive: true })

    expect(await findRepoRoot(nested)).toBe(tempDir)
  })

  it('does not treat a bare .paradoc directory as a project root', async () => {
    // This is the CLI's own global config shape: a `.paradoc` directory with
    // no `paradoc.json` beside it, as it writes under the user's home
    // directory. It must not be mistaken for a project.
    await fs.mkdir(join(tempDir, '.paradoc'))

    expect(await findRepoRoot(tempDir)).toBeNull()
  })

  it('skips a global-config-shaped ancestor and keeps looking further up', async () => {
    // A home directory carrying only `.paradoc` (global config), with a real
    // project nested inside it.
    await fs.mkdir(join(tempDir, '.paradoc'))
    const project = join(tempDir, 'projects', 'my-project')
    await fs.mkdir(project, { recursive: true })
    await fs.mkdir(join(project, '.paradoc'))
    await fs.writeFile(join(project, 'paradoc.json'), '{}')

    expect(await findRepoRoot(project)).toBe(project)
    // Starting from a sibling with no project marker of its own, the walk
    // passes through the home-shaped ancestor without stopping there, and
    // finds nothing above it.
    const sibling = join(tempDir, 'elsewhere')
    await fs.mkdir(sibling)
    expect(await findRepoRoot(sibling)).toBeNull()
  })

  it('returns null when nothing above the start directory is a project', async () => {
    expect(await findRepoRoot(tempDir)).toBeNull()
  })
})
