/**
 * Network stub for spawned CLI runs: routes every fetch through a proxy on a
 * local port that nothing listens on, so any registry host is unreachable and
 * no request leaves the machine.
 */

import { createServer } from 'node:net'
import type { AddressInfo } from 'node:net'

export async function unreachableNetworkEnv(): Promise<Record<string, string>> {
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  await new Promise<void>((resolve) => server.close(() => resolve()))
  const proxy = `http://127.0.0.1:${port}`
  return { HTTPS_PROXY: proxy, HTTP_PROXY: proxy, https_proxy: proxy, http_proxy: proxy }
}
