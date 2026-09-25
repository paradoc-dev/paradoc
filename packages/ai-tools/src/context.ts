import type { ParadocToolsConfig } from './config'

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

/** Compose application and framework cancellation into one per-call configuration. */
export function configForExecution(
	config: ParadocToolsConfig | undefined,
	frameworkSignal?: AbortSignal,
): ParadocToolsConfig {
	const signals = [config?.signal, config?.context?.signal, frameworkSignal].filter(
		(signal): signal is AbortSignal => signal !== undefined,
	)
	const signal = signals.length === 0
		? undefined
		: signals.length === 1
			? signals[0]
			: AbortSignal.any(signals)
	const context = config?.context
		? signal === config.context.signal
			? config.context
			: { ...config.context, ...(signal ? { signal } : {}) }
		: createToolExecutionContext(signal ? { signal } : {})

	return {
		...config,
		...(signal ? { signal } : {}),
		context,
	}
}

export function cacheKey(url: string, maxBytes: number, scope = ''): string {
	return `${scope}\u0000${url}\u0000${maxBytes}`
}
