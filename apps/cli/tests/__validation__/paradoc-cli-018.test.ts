import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

vi.mock('../../src/utils/constants.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/utils/constants.js')>()
  return { ...mod, NETWORK_TIMEOUTS: { CONNECT_TIMEOUT: 300, DOWNLOAD_TIMEOUT: 300 } }
})

const { registryClient, RequestTimeoutError } = await import('../../src/utils/registry-client.js')
let server: http.Server
let base = ''
const open: http.ServerResponse[] = []

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/body') {
      res.writeHead(200, { 'content-type': 'text/markdown' })
      res.write('# partial')
    }
    open.push(res)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://localhost:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  for (const response of open) response.destroy()
  server.closeAllConnections()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

const registry = { namespace: '@test', baseUrl: '', headers: {} } as never

describe('paradoc-cli-018', () => {
  it.each(['headers', 'body'])('bounds a stalled %s download', async (kind) => {
    const pending = registryClient.fetchLayerBinary(registry, `${base}/${kind}`, ['text/markdown'])
    const result = await Promise.race([
      pending.then(() => null, (error: unknown) => error),
      new Promise((resolve) => setTimeout(() => resolve('still pending'), 3_000)),
    ])
    expect(result).toBeInstanceOf(RequestTimeoutError)
  })
})
