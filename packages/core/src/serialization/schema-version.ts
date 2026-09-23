import { PARADOC_SCHEMA_URL, SCHEMA_VERSION, readSchemaAddress } from '@paradoc/schemas'
import { LoadError } from './load-error'

/**
 * Why an artifact's schema version cannot be loaded.
 *
 * - `missing-version`: an artifact file has no `$schema`.
 * - `outdated-version`: `$schema` names an earlier published version.
 * - `unknown-version`: `$schema` names no published version, names no
 *   version at all (the undated `schema.json`), or is not a Paradoc address.
 */
export type SchemaVersionErrorCode = 'missing-version' | 'outdated-version' | 'unknown-version'

/**
 * An artifact does not follow the current schema version.
 *
 * Loading never migrates: the message names what was found, the current
 * version, and the `paradoc migrate` command that upgrades the file.
 */
export class SchemaVersionError extends LoadError {
	readonly current = SCHEMA_VERSION

	constructor(
		readonly code: SchemaVersionErrorCode,
		/** The `$schema` value found, when there was one. */
		readonly found: unknown,
		message: string,
	) {
		super(message)
		this.name = 'SchemaVersionError'
	}
}

const CURRENT = `the current schema version is ${SCHEMA_VERSION} (${PARADOC_SCHEMA_URL})`

/**
 * Check that an artifact follows the current schema version.
 *
 * With `required`, the artifact must carry `$schema`: this is the rule for
 * artifact files, from JSON or YAML. Without it, an artifact with no
 * `$schema` is accepted as one built in memory with the SDK, which is always
 * the current version, but a `$schema` it does carry must still be current.
 */
export function assertCurrentSchemaVersion(artifact: unknown, options: { required: boolean }): void {
	if (typeof artifact !== 'object' || artifact === null) return
	const address = (artifact as { $schema?: unknown }).$schema
	if (address === undefined) {
		if (!options.required) return
		throw new SchemaVersionError(
			'missing-version',
			undefined,
			`The artifact has no $schema; ${CURRENT}. Run paradoc migrate <file> --from <version> to add it.`,
		)
	}
	const read = typeof address === 'string' ? readSchemaAddress(address) : ({ kind: 'foreign' } as const)
	switch (read.kind) {
		case 'known':
			if (read.version === SCHEMA_VERSION) return
			throw new SchemaVersionError(
				'outdated-version',
				address,
				`The artifact was written for schema version ${read.version}; ${CURRENT}. Run paradoc migrate <file> to upgrade it.`,
			)
		case 'undated':
			throw new SchemaVersionError(
				'unknown-version',
				address,
				`$schema ${String(address)} names no schema version; ${CURRENT}. Run paradoc migrate <file> --from <version> to name it.`,
			)
		case 'unknown-version':
			throw new SchemaVersionError(
				'unknown-version',
				address,
				`$schema names schema version ${read.version}, which does not exist; ${CURRENT}. Run paradoc migrate <file> --from <version> once you know its version.`,
			)
		case 'foreign':
			throw new SchemaVersionError(
				'unknown-version',
				address,
				`$schema ${JSON.stringify(address)} is not a Paradoc schema address; ${CURRENT}. Run paradoc migrate <file> --from <version> once you know its version.`,
			)
	}
}
