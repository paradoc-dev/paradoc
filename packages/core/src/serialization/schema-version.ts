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
 * Nothing but `migrate` accepts another version: the message names what was
 * found, the current version, and the `paradoc migrate` command that upgrades
 * the file.
 */
export class SchemaVersionError extends LoadError {
	readonly current = SCHEMA_VERSION

	constructor(
		readonly code: SchemaVersionErrorCode,
		/** The `$schema` value found, when there was one. */
		readonly found: unknown,
		message: string,
		/** Where the offending `$schema` sits: `['$schema']` on the root, deeper for an inline bundle part. */
		readonly path: readonly (string | number)[] = ['$schema'],
	) {
		super(message)
		this.name = 'SchemaVersionError'
	}
}

const CURRENT = `the current schema version is ${SCHEMA_VERSION} (${PARADOC_SCHEMA_URL})`

type ArtifactShape = { $schema?: unknown; kind?: unknown; contents?: unknown }

/**
 * The schema version problem of an artifact, or `undefined` when it follows
 * the current version.
 *
 * With `required`, the artifact must carry `$schema`: this is the rule for
 * artifact files, from JSON or YAML. Without it, an artifact with no
 * `$schema` is accepted as one built in memory with the SDK, which is always
 * the current version, but a `$schema` it does carry must still be current.
 *
 * A bundle's inline parts are held to the same rule. They may leave out
 * `$schema`, as `migrate` does not add one to them, but one they declare must
 * be current.
 */
export function findSchemaVersionError(
	artifact: unknown,
	options: { required: boolean },
): SchemaVersionError | undefined {
	return checkArtifact(artifact, options.required, [], undefined)
}

/**
 * Throw a {@link SchemaVersionError} unless an artifact, and every inline part
 * of a bundle, follows the current schema version. The rules are those of
 * {@link findSchemaVersionError}.
 */
export function assertCurrentSchemaVersion(artifact: unknown, options: { required: boolean }): void {
	const error = findSchemaVersionError(artifact, options)
	if (error) throw error
}

function checkArtifact(
	artifact: unknown,
	required: boolean,
	at: readonly (string | number)[],
	inlineKey: string | undefined,
): SchemaVersionError | undefined {
	if (typeof artifact !== 'object' || artifact === null) return undefined
	const { $schema: address, kind, contents } = artifact as ArtifactShape
	const own = checkAddress(address, required, [...at, '$schema'], inlineKey)
	if (own) return own
	if (kind !== 'bundle' || !Array.isArray(contents)) return undefined
	for (const [index, item] of contents.entries()) {
		if (typeof item !== 'object' || item === null) continue
		const { type, key, artifact: part } = item as { type?: unknown; key?: unknown; artifact?: unknown }
		if (type !== 'inline') continue
		const partKey = typeof key === 'string' ? key : String(index)
		const nested = checkArtifact(part, false, [...at, 'contents', index, 'artifact'], partKey)
		if (nested) return nested
	}
	return undefined
}

function checkAddress(
	address: unknown,
	required: boolean,
	path: readonly (string | number)[],
	inlineKey: string | undefined,
): SchemaVersionError | undefined {
	const subject = inlineKey === undefined ? 'The artifact' : `The inline artifact "${inlineKey}"`
	const where = inlineKey === undefined ? '' : `${subject}: `
	if (address === undefined) {
		if (!required) return undefined
		return new SchemaVersionError(
			'missing-version',
			undefined,
			`${subject} has no $schema; ${CURRENT}. Run paradoc migrate <file> --from <version> to add it.`,
			path,
		)
	}
	const read = typeof address === 'string' ? readSchemaAddress(address) : ({ kind: 'foreign' } as const)
	switch (read.kind) {
		case 'known':
			if (read.version === SCHEMA_VERSION) return undefined
			return new SchemaVersionError(
				'outdated-version',
				address,
				`${subject} was written for schema version ${read.version}; ${CURRENT}. Run paradoc migrate <file> to upgrade it.`,
				path,
			)
		case 'undated':
			return new SchemaVersionError(
				'unknown-version',
				address,
				`${where}$schema ${String(address)} names no schema version; ${CURRENT}. Run paradoc migrate <file> --from <version> to name it.`,
				path,
			)
		case 'unknown-version':
			return new SchemaVersionError(
				'unknown-version',
				address,
				`${where}$schema names schema version ${read.version}, which does not exist; ${CURRENT}. Run paradoc migrate <file> --from <version> once you know its version.`,
				path,
			)
		case 'foreign':
			return new SchemaVersionError(
				'unknown-version',
				address,
				`${where}$schema ${JSON.stringify(address)} is not a Paradoc schema address; ${CURRENT}. Run paradoc migrate <file> --from <version> once you know its version.`,
				path,
			)
	}
}
