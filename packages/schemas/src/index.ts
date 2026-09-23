import { SCHEMA_VERSIONED_ID } from './zod/config'

/** Dated schema address that serialized artifacts carry: the current schema version. */
export const PARADOC_SCHEMA_URL = SCHEMA_VERSIONED_ID

// Export Zod schemas for runtime validation
export * from './zod'
