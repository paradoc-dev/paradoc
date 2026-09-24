/**
 * Schema version identity.
 *
 * Each version of the artifact schema is identified by a date and published
 * at a dated address, such as `https://schema.paradoc.dev/2026-09-24.json`.
 * A new dated version is created only for a breaking change, and each one
 * ships with a migration step from the version before it. The current version
 * is the latest entry in `SCHEMA_VERSIONS`.
 */

/** Every published schema version, oldest first. The last entry is current. */
export const SCHEMA_VERSIONS = ['2026-01-01', '2026-08-06', '2026-08-10', '2026-09-22', '2026-09-23', '2026-09-24'] as const;

/** A published, dated schema version. */
export type SchemaVersion = (typeof SCHEMA_VERSIONS)[number];

/** The current schema version: the latest dated version. */
export const SCHEMA_VERSION = '2026-09-24' as const satisfies SchemaVersion;

export const SCHEMA_BASE = 'https://schema.paradoc.dev';

/** Undated address of the latest bundle, kept for editors that follow it. */
export const SCHEMA_ROOT_ID = `${SCHEMA_BASE}/schema.json`;

/** Dated address of the current version's bundle. */
export const SCHEMA_VERSIONED_ID = `${SCHEMA_BASE}/${SCHEMA_VERSION}.json`;

// For individual schema URLs
export const schemaId = (name: string) => `${SCHEMA_BASE}/${SCHEMA_VERSION}/${name}.json`;

/** The dated address of one schema version's bundle. */
export function schemaVersionUrl(version: SchemaVersion): string {
	return `${SCHEMA_BASE}/${version}.json`;
}

/** Whether a string names a published schema version. */
export function isSchemaVersion(value: string): value is SchemaVersion {
	return (SCHEMA_VERSIONS as readonly string[]).includes(value);
}

/**
 * What an artifact's `$schema` address says about its schema version.
 *
 * - `known`: a dated Paradoc address of a published version.
 * - `undated`: a Paradoc address that names no version, such as `schema.json`.
 * - `unknown-version`: a dated Paradoc address of a version that was never published.
 * - `foreign`: an address that is not a Paradoc schema address.
 */
export type SchemaAddress =
	| { readonly kind: 'known'; readonly version: SchemaVersion }
	| { readonly kind: 'undated' }
	| { readonly kind: 'unknown-version'; readonly version: string }
	| { readonly kind: 'foreign' };

const DATED_ADDRESS = /^([0-9]{4}-[0-9]{2}-[0-9]{2})(?:\.json|\/[a-z][a-z0-9-]*\.json)$/;

/**
 * Read the schema version an artifact's `$schema` address names.
 *
 * Both the dated bundle (`<base>/2026-08-10.json`) and a dated individual
 * schema (`<base>/2026-08-10/form.json`) name that version.
 */
export function readSchemaAddress(address: string): SchemaAddress {
	const prefix = `${SCHEMA_BASE}/`;
	if (!address.startsWith(prefix)) return { kind: 'foreign' };
	const rest = address.slice(prefix.length);
	const match = DATED_ADDRESS.exec(rest);
	if (!match) return { kind: 'undated' };
	const version = match[1] as string;
	return isSchemaVersion(version) ? { kind: 'known', version } : { kind: 'unknown-version', version };
}
