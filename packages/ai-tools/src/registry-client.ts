import { z } from 'zod'
import type { ParadocToolsConfig } from './config'
import type { ToolExecutionContext } from './context'
import { cacheKey } from './context'

export const MAX_INDEX_SIZE = 1_048_576
export const MAX_ITEM_SIZE = 1_048_576
export const MAX_INSTRUCTIONS_SIZE = 5_242_880
export const MAX_LAYER_FILE_SIZE = 20_971_520
export const FETCH_TIMEOUT_MS = 10_000
export const DEFAULT_MAX_REDIRECTS = 3

const fetchIdentities = new WeakMap<typeof globalThis.fetch, number>()
let nextFetchIdentity = 1

function fetchScope(fetchFn: typeof globalThis.fetch, customFetch: typeof globalThis.fetch | undefined): string {
	if (!customFetch) return 'global'
	const existing = fetchIdentities.get(fetchFn)
	if (existing) return `custom:${existing}`
	const identity = nextFetchIdentity++
	fetchIdentities.set(fetchFn, identity)
	return `custom:${identity}`
}

const RegistryIndexSchema = z.object({
	artifactsPath: z.string().optional(),
	items: z.array(z.object({ name: z.string(), path: z.string().optional() })),
})

export interface RegistryIndex {
	artifactsPath?: string
	items: Array<{ name: string; path?: string }>
}

export interface FetchPolicy {
	allowLocalDevelopment?: boolean
	approvedOrigins?: readonly string[]
	maxRedirects?: number
	context?: ToolExecutionContext
	signal?: AbortSignal
}

function hostnameOf(url: URL): string {
	return url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
}

function isIpv4(hostname: string): boolean {
	const parts = hostname.split('.')
	return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

function isPrivateIpv4(hostname: string): boolean {
	if (!isIpv4(hostname)) return false
	const parts = hostname.split('.')
	const a = Number(parts[0])
	const b = Number(parts[1])
	return (
		a === 0 ||
		a === 10 ||
		(a === 100 && b >= 64 && b <= 127) ||
		(a === 127) ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168) ||
		(a === 198 && (b === 18 || b === 19))
	)
}

function isPrivateIpv6(hostname: string): boolean {
	const normalized = hostname.toLowerCase()
	if (!normalized.includes(':')) return false
	// WHATWG URL canonicalizes IPv4-mapped addresses (for example
	// ::ffff:127.0.0.1) to hexadecimal IPv6 notation. Treat the whole mapped
	// range as private so an IPv4 loopback/private address cannot bypass the
	// lexical egress policy.
	if (normalized.startsWith('::ffff:')) return true
	const mapped = normalized.match(/:(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/)
	if (mapped && isPrivateIpv4(mapped[1]!)) return true
	return (
		normalized === '::' ||
		normalized === '::1' ||
		normalized.startsWith('fc') ||
		normalized.startsWith('fd') ||
		normalized.startsWith('fe8') ||
		normalized.startsWith('fe9') ||
		normalized.startsWith('fea') ||
		normalized.startsWith('feb') ||
		normalized.startsWith('ff')
	)
}

function isLoopback(hostname: string): boolean {
	return hostname === 'localhost' || hostname === 'localhost.localdomain' || hostname === '::1' || hostname === '127.0.0.1'
}

function isPrivateHost(hostname: string): boolean {
	return (
		isPrivateIpv4(hostname) ||
		isPrivateIpv6(hostname) ||
		hostname.endsWith('.local') ||
		hostname.endsWith('.internal') ||
		hostname === 'metadata.google.internal' ||
		hostname === 'metadata.google'
	)
}

function originAllowed(url: URL, origins: readonly string[] | undefined): boolean {
	if (!origins || origins.length === 0) return true
	return origins.some((origin) => {
		try {
			return new URL(origin).origin === url.origin
		} catch {
			return false
		}
	})
}

/**
 * Apply the lexical portion of the transport policy. Hostname checks cannot
 * prevent DNS rebinding; callers running on an untrusted network must pair
 * this with an approved-origin list or a connection-level egress policy.
 */
export function validateFetchUrl(url: string, policy: Pick<FetchPolicy, 'allowLocalDevelopment' | 'approvedOrigins'> = {}): void {
	let parsed: URL
	try {
		parsed = new URL(url)
	} catch {
		throw new Error(`Invalid URL: ${url}`)
	}

	const hostname = hostnameOf(parsed)
	const local = isLoopback(hostname) || isPrivateHost(hostname)
	if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && policy.allowLocalDevelopment && local)) {
		throw new Error(`Only HTTPS URLs are allowed: ${url}`)
	}
	if (local && !policy.allowLocalDevelopment) {
		throw new Error(`Fetching from private/internal hosts requires local development mode: ${hostname}`)
	}
	if (!originAllowed(parsed, policy.approvedOrigins)) {
		throw new Error(`Origin is not approved for registry access: ${parsed.origin}`)
	}
}

async function readBodyWithLimit(res: Response, maxBytes: number): Promise<ArrayBuffer> {
	if (!res.body) {
		const body = await res.arrayBuffer()
		if (body.byteLength > maxBytes) throw new Error(`Response body exceeded ${maxBytes} bytes limit`)
		return body
	}

	const reader = res.body.getReader()
	const chunks: Uint8Array[] = []
	let totalSize = 0
	try {
		while (true) {
			const { done, value } = await reader.read()
			if (done) break
			if (!value) continue
			totalSize += value.byteLength
			if (totalSize > maxBytes) {
				await reader.cancel()
				throw new Error(`Response body exceeded ${maxBytes} bytes limit`)
			}
			chunks.push(value)
		}
	} finally {
		reader.releaseLock()
	}

	const result = new Uint8Array(totalSize)
	let offset = 0
	for (const chunk of chunks) {
		result.set(chunk, offset)
		offset += chunk.byteLength
	}
	return result.buffer
}


function responseFromCache(value: { url: string; status: number; statusText: string; headers: Headers; body: ArrayBuffer }): Response {
	const response = new Response(value.body.slice(0), {
		status: value.status,
		statusText: value.statusText,
		headers: value.headers,
	})
	try {
		Object.defineProperty(response, 'url', { configurable: true, value: value.url })
	} catch {
		// Some Fetch implementations expose a non-configurable URL accessor.
	}
	return response
}

function mergeSignals(parent: AbortSignal | undefined, timeoutMs: number): { signal: AbortSignal; dispose: () => void } {
	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs)
	const onAbort = () => controller.abort(parent?.reason)
	if (parent) {
		if (parent.aborted) onAbort()
		else parent.addEventListener('abort', onAbort, { once: true })
	}
	return {
		signal: controller.signal,
		dispose: () => {
			clearTimeout(timer)
			parent?.removeEventListener('abort', onAbort)
		},
	}
}

/** Fetch with explicit redirect, origin, timeout, cancellation, and body policy. */
export async function safeFetch(
	url: string,
	maxBytes: number,
	customFetch?: typeof globalThis.fetch,
	policy: FetchPolicy = {},
): Promise<Response> {
	const fetchFn = customFetch ?? globalThis.fetch
	let currentUrl = url
	const maxRedirects = Number.isFinite(policy.maxRedirects)
		? Math.max(0, Math.floor(policy.maxRedirects!))
		: DEFAULT_MAX_REDIRECTS

	for (let redirect = 0; ; redirect += 1) {
		validateFetchUrl(currentUrl, policy)
		const parentSignal = policy.signal ?? policy.context?.signal
		if (parentSignal?.aborted) throw parentSignal.reason instanceof Error ? parentSignal.reason : new Error('Request aborted')
		const cache = policy.context?.cache
		const scope = [
			policy.allowLocalDevelopment ? 'local' : 'remote',
			policy.maxRedirects ?? DEFAULT_MAX_REDIRECTS,
			(policy.approvedOrigins ?? []).join(','),
			fetchScope(fetchFn, customFetch),
		].join('|')
		const key = cacheKey(currentUrl, maxBytes, scope)
		const cached = cache?.responses.get(key)
		if (cached) return responseFromCache(cached)

		const merged = mergeSignals(policy.signal ?? policy.context?.signal, FETCH_TIMEOUT_MS)
		let response: Response
		try {
			response = await fetchFn(currentUrl, { signal: merged.signal, redirect: 'manual' })
		} catch (error) {
			merged.dispose()
			throw error
		}

		if (response.status >= 300 && response.status < 400) {
			merged.dispose()
			if (redirect >= maxRedirects) throw new Error(`Too many redirects while fetching ${url}`)
			const location = response.headers.get('location')
			if (!location) throw new Error(`Redirect response from ${currentUrl} did not include a location`)
			currentUrl = new URL(location, currentUrl).toString()
			continue
		}

		try {
			if (!response.ok) throw new Error(`Fetch failed: ${currentUrl} (${response.status})`)
			const contentLength = response.headers.get('content-length')
			if (contentLength && Number.isFinite(Number(contentLength)) && Number(contentLength) > maxBytes) {
				throw new Error(`Response too large: ${contentLength} bytes (limit ${maxBytes})`)
			}

			const body = await readBodyWithLimit(response, maxBytes)
			const snapshot = {
				url: response.url || currentUrl,
				status: response.status,
				statusText: response.statusText,
				headers: new Headers(response.headers),
				body,
			}
			if (cache) {
				const configuredMaxEntries = cache.maxEntries ?? 32
				const maxEntries = Number.isFinite(configuredMaxEntries) ? Math.max(1, Math.floor(configuredMaxEntries)) : 32
				if (!cache.responses.has(key) && cache.responses.size >= maxEntries) {
					const oldest = cache.responses.keys().next().value
					if (oldest !== undefined) cache.responses.delete(oldest)
				}
				cache.responses.set(key, snapshot)
			}
			return responseFromCache(snapshot)
		} finally {
			merged.dispose()
		}
	}
}

function trimBase(url: string): string {
	return new URL(url).toString().replace(/\/$/, '')
}

export function registryUrlFromConfig(inputUrl: string | undefined, config?: ParadocToolsConfig): string | undefined {
	return inputUrl ?? config?.defaultRegistryUrl
}

export function fetchPolicyFromConfig(config?: ParadocToolsConfig): FetchPolicy {
	return {
		allowLocalDevelopment: config?.allowLocalDevelopment,
		approvedOrigins: config?.approvedOrigins,
		maxRedirects: config?.maxRedirects,
		context: config?.context,
		signal: config?.signal,
	}
}

export async function fetchRegistryIndexResponse(
	baseUrl: string,
	customFetch?: typeof globalThis.fetch,
	config?: ParadocToolsConfig,
): Promise<{ index: RegistryIndex; response: Response }> {
	const url = new URL('registry.json', `${trimBase(baseUrl)}/`).toString()
	const res = await safeFetch(url, MAX_INDEX_SIZE, customFetch, fetchPolicyFromConfig(config))
	const parsed = RegistryIndexSchema.safeParse(await res.json())
	if (!parsed.success) throw new Error(`Invalid registry index format: ${parsed.error.message}`)
	return { index: parsed.data, response: res }
}

export async function fetchRegistryIndex(
	baseUrl: string,
	customFetch?: typeof globalThis.fetch,
	config?: ParadocToolsConfig,
): Promise<RegistryIndex> {
	return (await fetchRegistryIndexResponse(baseUrl, customFetch, config)).index
}

function assertRelativePath(path: string, label: string): void {
	if (!path || path.startsWith('/') || /^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith('\\')) {
		throw new Error(`${label} must be a relative path: ${path}`)
	}
}

/** Resolve a registry-owned relative path without allowing origin or root escape. */
export function resolveRelativeUrl(baseUrl: string, relativePath: string, label = 'Path'): string {
	const root = new URL(`${trimBase(baseUrl)}/`)
	assertRelativePath(relativePath, label)
	const result = new URL(relativePath, root)
	if (result.origin !== root.origin || !result.pathname.startsWith(root.pathname)) {
		throw new Error(`${label} escaped its registry root: ${relativePath}`)
	}
	return result.toString()
}

/** Build an item URL while keeping the resolved path inside the registry's artifact root. */
export function buildArtifactItemUrl(
	baseUrl: string,
	artifactsPath: string | undefined,
	artifactName: string,
	itemPath?: string,
): string {
	const base = new URL(`${trimBase(baseUrl)}/`)
	const root = new URL(`${artifactsPath ? `${artifactsPath.replace(/^\/+|\/+$/g, '')}/` : ''}`, base)
	const basePath = base.pathname.endsWith('/') ? base.pathname : `${base.pathname}/`
	if (root.origin !== base.origin || !root.pathname.startsWith(basePath)) {
		throw new Error('Artifact path must remain inside the registry root')
	}
	const relative = itemPath ?? `${encodeURIComponent(artifactName)}.json`
	assertRelativePath(relative, 'Artifact item path')
	const result = new URL(relative, root)
	if (result.origin !== root.origin || !result.pathname.startsWith(root.pathname)) {
		throw new Error(`Artifact path escaped registry root: ${relative}`)
	}
	return result.toString()
}

export async function fetchRegistryItemResponse(
	baseUrl: string,
	artifactsPath: string | undefined,
	artifactName: string,
	itemPath?: string,
	customFetch?: typeof globalThis.fetch,
	config?: ParadocToolsConfig,
): Promise<{ artifact: Record<string, unknown>; response: Response }> {
	const url = buildArtifactItemUrl(baseUrl, artifactsPath, artifactName, itemPath)
	const res = await safeFetch(url, MAX_ITEM_SIZE, customFetch, fetchPolicyFromConfig(config))
	const value = await res.json()
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Registry artifact must be a JSON object')
	return { artifact: value as Record<string, unknown>, response: res }
}

export async function fetchRegistryItem(
	baseUrl: string,
	artifactsPath: string | undefined,
	artifactName: string,
	itemPath?: string,
	customFetch?: typeof globalThis.fetch,
	config?: ParadocToolsConfig,
): Promise<Record<string, unknown>> {
	return (await fetchRegistryItemResponse(baseUrl, artifactsPath, artifactName, itemPath, customFetch, config)).artifact
}

export function bytesToBase64(bytes: Uint8Array): string {
	const toBase64 = (bytes as Uint8Array & { toBase64?: () => string }).toBase64
	if (typeof toBase64 === 'function') return toBase64.call(bytes)
	if (typeof globalThis.btoa !== 'function') throw new Error('This runtime cannot encode binary tool output as base64')
	let result = ''
	const chunkSize = 0x8000
	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		result += globalThis.btoa(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)))
	}
	return result
}

export function bytesToText(bytes: Uint8Array): string {
	return new TextDecoder().decode(bytes)
}
