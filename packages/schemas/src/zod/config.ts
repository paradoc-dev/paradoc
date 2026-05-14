export const SCHEMA_VERSION = '2026-01-01' as const;
export const SCHEMA_BASE = 'https://schema.paradoc.dev';
export const SCHEMA_ROOT_ID = `${SCHEMA_BASE}/schema.json`;
export const SCHEMA_VERSIONED_ID = `${SCHEMA_BASE}/${SCHEMA_VERSION}.json`;

// For individual schema URLs
export const schemaId = (name: string) => `${SCHEMA_BASE}/${SCHEMA_VERSION}/${name}.json`;
