export interface ParadocToolsConfig {
  /** Default registry URL (e.g. 'https://public.paradoc.dev') */
  defaultRegistryUrl?: string
  /** Custom fetch implementation (for auth headers, test mocks, etc.) */
  fetch?: typeof globalThis.fetch
}
