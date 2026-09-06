/**
 * `para add <name>` installs a document component.
 *
 * The install itself is the shadcn CLI's, so what is tested here is everything
 * around it: that a bare name is read as a component and a namespaced one still
 * as an artifact, that the `@paradoc` namespace lands in `components.json`
 * without disturbing the rest of the file, that a namespace already pointing
 * elsewhere is refused rather than overwritten, and that the command handed to
 * the shadcn CLI is the one the docs tell people to run.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

import {
  addComponents,
  COMPONENT_ITEMS,
  COMPONENT_NAMESPACE,
  COMPONENT_REGISTRY_URL,
  ensureNamespace,
  findComponentsConfig,
  isComponentName,
  SHADCN_SPEC,
} from '../../src/commands/add-component.js'

let project: string

beforeEach(async () => {
  project = await mkdtemp(join(tmpdir(), 'para-add-component-'))
})

afterEach(async () => {
  await rm(project, { recursive: true, force: true })
})

async function writeConfig(contents: Record<string, unknown>, at = project): Promise<string> {
  const path = join(at, 'components.json')
  await fs.writeFile(path, `${JSON.stringify(contents, null, 2)}\n`, 'utf8')
  return path
}

describe('telling a component from an artifact', () => {
  it('reads a known item name as a component', () => {
    expect(isComponentName('field')).toBe(true)
    expect(isComponentName('keep-together')).toBe(true)
  })

  it('leaves an artifact reference, a namespace and a URL alone', () => {
    expect(isComponentName('@paradoc/w9')).toBe(false)
    expect(isComponentName('@paradoc')).toBe(false)
    expect(isComponentName('https://registry.example.com/r/w9.json')).toBe(false)
  })

  it('leaves a bare name the registry does not ship to the artifact path', () => {
    // It gets the artifact error, which names both forms, rather than being
    // sent to the shadcn CLI to fail on a 404.
    expect(isComponentName('invalid-ref')).toBe(false)
    expect(isComponentName('Field')).toBe(false)
    expect(isComponentName('field.tsx')).toBe(false)
    expect(isComponentName('../field')).toBe(false)
    expect(isComponentName('')).toBe(false)
  })

  it('lists exactly what the registry serves', async () => {
    // The CLI ships on its own and cannot import the registry manifest, so the
    // item list is repeated here. This is what keeps the copy honest: it reads
    // the index the docs site serves and fails when the two drift.
    const indexPath = join(
      __dirname,
      '../../../../apps/docs/public/r/registry.json',
    )
    const index = JSON.parse(await fs.readFile(indexPath, 'utf8')) as {
      name: string
      items: { name: string }[]
    }

    expect(`@${index.name}`).toBe(COMPONENT_NAMESPACE)
    expect([...COMPONENT_ITEMS].sort()).toEqual(index.items.map((item) => item.name).sort())
  })
})

describe('finding the project', () => {
  it('walks up to the components.json that governs the directory', async () => {
    const configPath = await writeConfig({ style: 'new-york' })
    const nested = join(project, 'src', 'components')
    await fs.mkdir(nested, { recursive: true })

    expect(await findComponentsConfig(nested)).toBe(configPath)
  })

  it('finds nothing when the project has no shadcn config', async () => {
    expect(await findComponentsConfig(project)).toBeNull()
  })
})

describe('registering the namespace', () => {
  it('adds it, keeping the rest of the file', async () => {
    const configPath = await writeConfig({
      style: 'new-york',
      aliases: { components: '@/components' },
    })

    expect(await ensureNamespace(configPath)).toBe('added')

    const written = JSON.parse(await fs.readFile(configPath, 'utf8'))
    expect(written.registries[COMPONENT_NAMESPACE]).toBe(COMPONENT_REGISTRY_URL)
    expect(written.style).toBe('new-york')
    expect(written.aliases).toEqual({ components: '@/components' })
  })

  it('leaves an already correct namespace untouched', async () => {
    const configPath = await writeConfig({
      registries: { [COMPONENT_NAMESPACE]: COMPONENT_REGISTRY_URL },
    })
    const before = await fs.readFile(configPath, 'utf8')

    expect(await ensureNamespace(configPath)).toBe('present')
    expect(await fs.readFile(configPath, 'utf8')).toBe(before)
  })

  it('refuses to repoint a namespace the project set itself', async () => {
    const configPath = await writeConfig({
      registries: { [COMPONENT_NAMESPACE]: 'https://mirror.example.com/r/{name}.json' },
    })

    expect(await ensureNamespace(configPath)).toBe('conflict')
    const written = JSON.parse(await fs.readFile(configPath, 'utf8'))
    expect(written.registries[COMPONENT_NAMESPACE]).toBe(
      'https://mirror.example.com/r/{name}.json',
    )
  })

  it('keeps another registry namespace beside ours', async () => {
    const configPath = await writeConfig({
      registries: { '@acme': 'https://acme.example.com/r/{name}.json' },
    })

    await ensureNamespace(configPath)

    const written = JSON.parse(await fs.readFile(configPath, 'utf8'))
    expect(written.registries['@acme']).toBe('https://acme.example.com/r/{name}.json')
    expect(written.registries[COMPONENT_NAMESPACE]).toBe(COMPONENT_REGISTRY_URL)
  })
})

describe('installing', () => {
  it('runs the documented shadcn command', async () => {
    await writeConfig({ style: 'new-york' })
    const printed: string[] = []
    const log = console.log
    console.log = (message?: unknown) => {
      printed.push(String(message))
    }

    try {
      expect(await addComponents(['field'], { cwd: project, dryRun: true })).toBe(0)
    } finally {
      console.log = log
    }

    expect(printed).toContain(`npx ${SHADCN_SPEC} add @paradoc/field --yes`)
  })

  it('fails with an explanation when the project has no shadcn config', async () => {
    const errors: string[] = []
    const error = console.error
    console.error = (message?: unknown) => {
      errors.push(String(message))
    }

    try {
      expect(await addComponents(['field'], { cwd: project, dryRun: true })).toBe(1)
    } finally {
      console.error = error
    }

    expect(errors.join('\n')).toContain('shadcn@latest init')
  })

  it('refuses a registry URL with no name placeholder', async () => {
    await writeConfig({ style: 'new-york' })
    const errors: string[] = []
    const error = console.error
    console.error = (message?: unknown) => {
      errors.push(String(message))
    }

    try {
      expect(
        await addComponents(['field'], {
          cwd: project,
          dryRun: true,
          registry: 'https://mirror.example.com/r/field.json',
        }),
      ).toBe(1)
    } finally {
      console.error = error
    }

    expect(errors.join('\n')).toContain('{name}')
  })

  it('installs from a registry the caller names, for a mirror', async () => {
    const configPath = await writeConfig({ style: 'new-york' })
    const printed: string[] = []
    const log = console.log
    console.log = (message?: unknown) => {
      printed.push(String(message))
    }

    try {
      await addComponents(['field'], {
        cwd: project,
        dryRun: true,
        registry: 'https://mirror.example.com/r/{name}.json',
      })
    } finally {
      console.log = log
    }

    const written = JSON.parse(await fs.readFile(configPath, 'utf8'))
    expect(written.registries[COMPONENT_NAMESPACE]).toBe(
      'https://mirror.example.com/r/{name}.json',
    )
  })
})
