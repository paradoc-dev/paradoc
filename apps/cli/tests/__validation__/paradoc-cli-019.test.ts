import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { runCli } from '../setup/spawn-cli.js'

let registry: http.Server
let proxy: http.Server
let registryUrl = ''
let proxyUrl = ''
const proxied: string[] = []

beforeAll(async () => {
  registry = http.createServer((_req, res) => {
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ name: 'test', items: [{ name: 'direct-item', kind: 'form', version: '1.0.0' }] }))
  })
  proxy = http.createServer((req, res) => { proxied.push(req.url ?? ''); res.writeHead(502); res.end() })
  proxy.on('connect', (req, socket) => { proxied.push(`CONNECT ${req.url}`); socket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n') })
  await new Promise<void>((resolve) => registry.listen(0, '127.0.0.1', resolve))
  await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve))
  registryUrl = `http://localhost:${(registry.address() as AddressInfo).port}`
  proxyUrl = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise<void>((resolve) => registry.close(() => resolve()))
  await new Promise<void>((resolve) => proxy.close(() => resolve()))
})

async function search(noProxy: string) {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'paradoc-019-'))
  await fs.mkdir(path.join(home, '.paradoc'))
  await fs.writeFile(path.join(home, '.paradoc/config.json'), JSON.stringify({ registries: { '@test': registryUrl } }))
  return runCli(['search', '--registry', '@test', '--json'], { target: 'dist', env: { HOME: home, HTTPS_PROXY: proxyUrl, HTTP_PROXY: proxyUrl, NO_PROXY: noProxy, no_proxy: '' } })
}

describe('paradoc-cli-019', () => {
  it('uses configured proxies', async () => {
    proxied.length = 0
    await search('')
    expect(proxied.length).toBeGreaterThan(0)
  })

  it('honors NO_PROXY', async () => {
    proxied.length = 0
    const result = await search('localhost,127.0.0.1')
    expect(proxied).toEqual([])
    expect(result.exitCode, result.stderr).toBe(0)
  })
})
