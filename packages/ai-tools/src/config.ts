export interface ProxyTextRendererConfig {
  /** Documents service base URL (e.g. https://paradoc-documents-dev.fly.dev) */
  url: string
  /** Bearer token for documents-service auth */
  apiKey: string
}

export interface ParadocToolsConfig {
  /** Default registry URL (e.g. 'https://public.paradoc.dev') */
  defaultRegistryUrl?: string
  /** Edge-compatible proxy for Handlebars text rendering */
  proxyTextRenderer?: ProxyTextRendererConfig
  /** Custom fetch implementation (for auth headers, test mocks, etc.) */
  fetch?: typeof globalThis.fetch
}
