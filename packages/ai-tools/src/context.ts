/**
 * Mutable only within one caller-owned request. The neutral package never
 * keeps this context globally, so cached registry data cannot cross users,
 * credentials, or registry configuration boundaries.
 */
export interface ToolExecutionContext {
	signal?: AbortSignal
	cache?: RequestCache
}

export interface CachedResponse {
	url: string
	status: number
	statusText: string
	headers: Headers
	body: ArrayBuffer
}

export interface RequestCache {
	responses: Map<string, CachedResponse>
	/** Maximum number of response bodies retained for this request. */
	maxEntries?: number
}

export function createToolExecutionContext(
	options: Omit<ToolExecutionContext, 'cache'> & { maxCacheEntries?: number } = {},
): ToolExecutionContext {
	const { maxCacheEntries = 32, ...context } = options
	return { ...context, cache: { responses: new Map(), maxEntries: maxCacheEntries } }
}

export function cacheKey(url: string, maxBytes: number, scope = ''): string {
	return `${scope}\u0000${url}\u0000${maxBytes}`
}
