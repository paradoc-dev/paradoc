export interface ParadocToolsConfig {
	/** Default registry URL (e.g. 'https://public.paradoc.dev') */
	defaultRegistryUrl?: string
	/** Custom fetch implementation (for auth headers, test mocks, etc.) */
	fetch?: typeof globalThis.fetch
	/** Opt into loopback and other local-development addresses. */
	allowLocalDevelopment?: boolean
	/** Optional origin allowlist applied to every registry, artifact, instruction, and layer request. */
	approvedOrigins?: readonly string[]
	/** Maximum number of validated redirects followed for one request. */
	maxRedirects?: number
	/** Shared request context. Create one per request or tool turn. */
	context?: import('./context').ToolExecutionContext
	/** Abort all work associated with this tool call. */
	signal?: AbortSignal
	/** Default model-facing render output budget. */
	maxOutputBytes?: number
}
