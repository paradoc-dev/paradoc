import { runCli as executeCliCommand } from '../setup/spawn-cli'
import { afterAll, beforeAll, describe, it, expect } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, promises as fs } from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { unreachableNetworkEnv } from '../setup/unreachable-network.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('CLI search command', () => {
  it('should show help', async () => {
    const result = await executeCliCommand(['search', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('--registry')
    expect(result.stdout).toContain('--kind')
    expect(result.stdout).toContain('--tags')
    expect(result.stdout).toContain('--json')
    expect(result.stdout).toContain('--no-cache')
  })

  it('fails for an unconfigured namespace, naming it and the add command', async () => {
    const result = await executeCliCommand(
      ['search', 'test', '--registry', '@nonexistent'],
      { cwd: os.tmpdir(), env: await unreachableNetworkEnv() }
    )

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('No registry is configured for @nonexistent. Run: paradoc registry add @nonexistent <url>')
  })

  it('searches @paradoc by default on a fresh install and names its host when it cannot be reached', async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), 'paradoc-search-home-'))
    try {
      const result = await executeCliCommand(['search', 'lease'], {
        cwd: home,
        env: { HOME: home, ...(await unreachableNetworkEnv()) },
      })

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('Cannot reach registry @paradoc at https://registry.paradoc.dev')
      expect(result.stderr).not.toContain('No registry is configured')
    } finally {
      await fs.rm(home, { recursive: true, force: true })
    }
  })

  it('rejects an invalid kind before contacting a registry', async () => {
    const result = await executeCliCommand(
      ['search', '--kind', 'invalid'],
      { cwd: os.tmpdir(), env: await unreachableNetworkEnv() }
    )

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Invalid kind: invalid')
    expect(result.stderr).not.toContain('Cannot reach')
  })
})

describe('CLI search and registry info cache configuration', () => {
  let itemName = 'first-item'
  let server: http.Server
  let registryUrl: string

  beforeAll(async () => {
    server = http.createServer((request, response) => {
      if (request.url === '/registry.json') {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({
          name: 'test',
          items: [{ name: itemName, kind: 'form', version: '1.0.0', title: itemName }],
        }))
        return
      }
      response.writeHead(404)
      response.end()
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    registryUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  async function setup(cache: Record<string, unknown>) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'paradoc-search-cache-'))
    const home = path.join(root, 'home')
    const cwd = path.join(root, 'work')
    await fs.mkdir(path.join(home, '.paradoc'), { recursive: true })
    await fs.mkdir(cwd, { recursive: true })
    await fs.writeFile(path.join(home, '.paradoc', 'config.json'), JSON.stringify({
      registries: { '@test': registryUrl },
      cache,
    }))
    return { root, home, cwd }
  }

  it('honors a zero TTL for search and registry info', async () => {
    const { root, home, cwd } = await setup({ ttl: 0 })
    try {
      itemName = 'first-item'
      const first = await executeCliCommand(['search', '--registry', '@test', '--json'], { cwd, env: { HOME: home } })
      expect(first.exitCode, first.stderr).toBe(0)
      expect(first.stdout).toContain('first-item')

      itemName = 'second-item'
      const second = await executeCliCommand(['search', '--registry', '@test', '--json'], { cwd, env: { HOME: home } })
      expect(second.exitCode, second.stderr).toBe(0)
      expect(second.stdout).toContain('second-item')

      const info = await executeCliCommand(['registry', 'info', '@test', '--json'], { cwd, env: { HOME: home } })
      expect(info.exitCode, info.stderr).toBe(0)
      const defaultCache = path.join(home, '.paradoc', 'cache')
      expect(existsSync(defaultCache) ? await fs.readdir(defaultCache) : []).toEqual([])
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  it('writes search results only to the configured cache directory', async () => {
    const customCache = await fs.mkdtemp(path.join(os.tmpdir(), 'paradoc-custom-cache-'))
    const { root, home, cwd } = await setup({ directory: customCache })
    try {
      const result = await executeCliCommand(['search', '--registry', '@test', '--json'], { cwd, env: { HOME: home } })
      expect(result.exitCode, result.stderr).toBe(0)
      const defaultCache = path.join(home, '.paradoc', 'cache')
      expect(existsSync(defaultCache) ? await fs.readdir(defaultCache) : []).toEqual([])
      expect((await fs.readdir(customCache)).length).toBeGreaterThan(0)
    } finally {
      await fs.rm(root, { recursive: true, force: true })
      await fs.rm(customCache, { recursive: true, force: true })
    }
  })
})
