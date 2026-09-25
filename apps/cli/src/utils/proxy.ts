/**
 * HTTP Proxy Support
 *
 * Reads proxy configuration from standard environment variables
 * (HTTPS_PROXY, HTTP_PROXY, https_proxy, http_proxy) and configures
 * undici's global dispatcher so all fetch() calls go through the proxy.
 *
 * Uses undici which ships with Node — no extra dependency needed.
 */

import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici'

let initialized = false

/**
 * Configure the global fetch dispatcher to use a proxy if env vars are set.
 * Safe to call multiple times — only runs once.
 */
export function initProxy(): void {
  if (initialized) return
  initialized = true

  if (!process.env.HTTPS_PROXY && !process.env.https_proxy && !process.env.HTTP_PROXY && !process.env.http_proxy) return

  setGlobalDispatcher(new EnvHttpProxyAgent({
    httpProxy: process.env.HTTP_PROXY || process.env.http_proxy,
    httpsProxy: process.env.HTTPS_PROXY || process.env.https_proxy,
    noProxy: process.env.NO_PROXY || process.env.no_proxy,
  }))
}
