import { z } from 'zod'

export const MAX_INDEX_SIZE = 1_048_576 // 1 MB
export const MAX_ITEM_SIZE = 1_048_576 // 1 MB
export const FETCH_TIMEOUT_MS = 10_000 // 10 s

// ---------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------

/** Validate fetch URLs. HTTPS is required except for loopback hosts in local dev/tests. */
export function validateFetchUrl(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Invalid URL: ${url}`)
  }

  const hostname = parsed.hostname
  const isLoopbackHost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === '[::1]'

  if (parsed.protocol !== 'https:') {
    if (parsed.protocol === 'http:' && isLoopbackHost) {
      return
    }
    throw new Error(`Only HTTPS URLs are allowed: ${url}`)
  }

  if (isLoopbackHost) {
    return
  }

  if (
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    hostname === 'metadata.google.internal'
  ) {
    throw new Error(`Fetching from private/internal hosts is not allowed: ${hostname}`)
  }
}

// ---------------------------------------------------------------------------
// Registry index schema
// ---------------------------------------------------------------------------

const RegistryIndexSchema = z.object({
  artifactsPath: z.string().optional(),
  items: z.array(z.object({ name: z.string(), path: z.string().optional() })),
})

export interface RegistryIndex {
  artifactsPath?: string
  items: Array<{ name: string; path?: string }>
}

// ---------------------------------------------------------------------------
// Safe fetch with URL validation and body size enforcement
// ---------------------------------------------------------------------------

/** Read response body enforcing a byte limit */
async function readBodyWithLimit(res: Response, maxBytes: number): Promise<ArrayBuffer> {
  const reader = res.body?.getReader()
  if (!reader) return new ArrayBuffer(0)

  const chunks: Uint8Array[] = []
  let totalSize = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    totalSize += value.byteLength
    if (totalSize > maxBytes) {
      await reader.cancel()
      throw new Error(`Response body exceeded ${maxBytes} bytes limit`)
    }
    chunks.push(value)
  }

  const result = new Uint8Array(totalSize)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result.buffer as ArrayBuffer
}

export async function safeFetch(
  url: string,
  maxBytes: number,
  customFetch?: typeof globalThis.fetch,
): Promise<Response> {
  validateFetchUrl(url)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  const fetchFn = customFetch ?? globalThis.fetch

  try {
    const res = await fetchFn(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`Fetch failed: ${url} (${res.status})`)

    const contentLength = res.headers.get('content-length')
    if (contentLength && Number(contentLength) > maxBytes) {
      throw new Error(`Response too large: ${contentLength} bytes (limit ${maxBytes})`)
    }

    const body = await readBodyWithLimit(res, maxBytes)
    return new Response(body, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    })
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Registry fetch helpers
// ---------------------------------------------------------------------------

/** Fetch registry.json from a registry base URL */
export async function fetchRegistryIndex(
  baseUrl: string,
  customFetch?: typeof globalThis.fetch,
): Promise<RegistryIndex> {
  const url = `${baseUrl.replace(/\/$/, '')}/registry.json`
  const res = await safeFetch(url, MAX_INDEX_SIZE, customFetch)
  const json: unknown = await res.json()
  const parsed = RegistryIndexSchema.safeParse(json)
  if (!parsed.success) {
    throw new Error(`Invalid registry index format: ${parsed.error.message}`)
  }
  return parsed.data
}

/** Build artifact item URL with path traversal protection */
export function buildArtifactItemUrl(
  baseUrl: string,
  artifactsPath: string | undefined,
  artifactName: string,
  itemPath?: string,
): string {
  const base = baseUrl.replace(/\/$/, '')
  const aPath = artifactsPath || ''
  const suffix = itemPath ? `/${itemPath}` : `/${artifactName}.json`

  const fullUrl = `${base}${aPath}${suffix}`
  const baseHost = new URL(base).host
  const resultHost = new URL(fullUrl).host
  if (baseHost !== resultHost) {
    throw new Error(
      `Path traversal detected: result host "${resultHost}" differs from base "${baseHost}"`,
    )
  }

  return fullUrl
}

/** Fetch a registry item (the JSON file containing the artifact) */
export async function fetchRegistryItem(
  baseUrl: string,
  artifactsPath: string | undefined,
  artifactName: string,
  itemPath?: string,
  customFetch?: typeof globalThis.fetch,
): Promise<Record<string, unknown>> {
  const url = buildArtifactItemUrl(baseUrl, artifactsPath, artifactName, itemPath)
  const res = await safeFetch(url, MAX_ITEM_SIZE, customFetch)
  return (await res.json()) as Record<string, unknown>
}
