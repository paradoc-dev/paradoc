/**
 * framework-cli-seam-012: after `add --output ts`, artifact commands must accept
 * the `@ns/name` reference. `resolveArtifactTarget` returns the `.ts` module
 * path and each caller parses it as JSON/YAML.
 */
import { spawnSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, inject, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const cliRoot = path.resolve(here, '../..')
const T =
  '/tmp/framework-cli-seam-012'
const REGISTRY = inject('testRegistryUrl')
const REF = '@acme/lease-addendum'

function cli(cwd: string, args: string[]) {
  const home = path.join(T, 'home')
  const r = spawnSync(process.execPath, [path.join(cliRoot, 'dist/index.js'), ...args], {
    cwd,
    env: { ...process.env, HOME: home, USERPROFILE: home, DO_NOT_TRACK: '1', NO_COLOR: '1', CI: '1' },
    encoding: 'utf8',
    timeout: 60000,
  })
  return { code: r.status, out: r.stdout + r.stderr }
}

async function project(output: string): Promise<string> {
  await fs.mkdir(T, { recursive: true })
  const dir = await fs.mkdtemp(path.join(T, `s012-${output}-`))
  await fs.mkdir(path.join(dir, '.paradoc'))
  await fs.writeFile(
    path.join(dir, 'paradoc.json'),
    JSON.stringify({
      $schema: 'https://schema.paradoc.dev/manifest.json',
      name: '@test/s012',
      title: 'S012',
      visibility: 'private',
      registries: { '@acme': { url: REGISTRY } },
    })
  )
  await fs.writeFile(path.join(dir, 'x.md'), '# x\n')
  const add = cli(dir, ['add', REF, '--output', output, '--no-cache'])
  if (add.code !== 0) throw new Error(`add failed: ${add.out}`)
  return dir
}

const COMMANDS: [string, string[]][] = [
  ['validate', ['validate', REF]],
  ['data template', ['data', 'template', REF]],
  ['render', ['render', REF, '--out', 'out.pdf']],
  ['attach', ['attach', REF, 'x.md', '-y', '--name', 'x']],
]

describe('framework-cli-seam-012', () => {
  it('control: commands resolve an --output yaml install', async () => {
    const dir = await project('yaml')
    try {
      for (const [, args] of COMMANDS.slice(0, 2)) {
        const r = cli(dir, args)
        expect(r.out).not.toContain('Unable to parse content')
      }
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  }, 120000)

  it('commands resolve an --output ts install', async () => {
    const dir = await project('ts')
    try {
      const failures: Record<string, string> = {}
      for (const [name, args] of COMMANDS) {
        const r = cli(dir, args)
        const line = r.out.split('\n').find((l) => l.includes('Unable to parse content'))
        if (line) failures[name] = line.trim()
      }
      expect(failures).toEqual({})
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  }, 120000)
})
