/**
 * Why a schema migration could not produce a current artifact.
 *
 * - `not-an-artifact`: the input is not an object with a `kind`.
 * - `missing-version`: the artifact declares no dated version and no source version was named.
 * - `unknown-version`: `$schema` names a version that was never published, or is not a Paradoc schema address.
 * - `version-conflict`: the named source version disagrees with the version the artifact declares.
 * - `no-migration-path`: no migration step leads from one version to the next.
 * - `unconvertible-value`: a step met a value it cannot convert safely.
 * - `invalid-result`: the migrated artifact does not validate against the current version.
 * - `unparseable`: the file content is neither valid JSON nor valid YAML.
 */
export type SchemaMigrationErrorCode =
	| 'not-an-artifact'
	| 'missing-version'
	| 'unknown-version'
	| 'version-conflict'
	| 'no-migration-path'
	| 'unconvertible-value'
	| 'invalid-result'
	| 'unparseable'

/** A migration failed; the artifact it was given is left as it was. */
export class SchemaMigrationError extends Error {
	constructor(
		readonly code: SchemaMigrationErrorCode,
		message: string,
	) {
		super(message)
		this.name = 'SchemaMigrationError'
	}
}

/**
 * Thrown by a migration step that meets a value it cannot convert safely.
 *
 * The migration reports the value and its path, and changes nothing.
 */
export class UnconvertibleValueError extends Error {
	constructor(
		readonly path: readonly (string | number)[],
		readonly value: unknown,
		readonly reason: string,
	) {
		super(`Cannot convert ${formatPath(path)} = ${JSON.stringify(value)}: ${reason}`)
		this.name = 'UnconvertibleValueError'
	}
}

function formatPath(path: readonly (string | number)[]): string {
	return path.length === 0 ? '(root)' : path.join('.')
}
