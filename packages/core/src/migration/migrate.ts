import { isMap, isScalar, parseDocument, type Document } from 'yaml'
import {
	PARADOC_SCHEMA_URL,
	SCHEMA_VERSION,
	SCHEMA_VERSIONS,
	readSchemaAddress,
	type SchemaVersion,
} from '@paradoc/schemas'
import { validate } from '@/validation/artifact'
import { deepClone } from '@/utils/clone'
import { SchemaMigrationError, UnconvertibleValueError } from './errors'
import { MIGRATION_STEPS, type ArtifactObject, type MigrationStep } from './steps'

export interface MigrateOptions {
	/**
	 * The version to migrate from when `$schema` names no published version:
	 * it is missing, undated (`schema.json`), unpublished, or not a Paradoc address.
	 */
	from?: SchemaVersion
	/** The ordered steps to apply. Defaults to `MIGRATION_STEPS`. */
	steps?: readonly MigrationStep[]
}

/** The outcome of migrating one artifact. */
export type ArtifactMigration =
	| { readonly status: 'current'; readonly version: SchemaVersion; readonly artifact: ArtifactObject }
	| {
			readonly status: 'migrated'
			readonly from: SchemaVersion
			readonly to: SchemaVersion
			/** The steps applied, in order. Empty when only `$schema` was written. */
			readonly steps: readonly MigrationStep[]
			readonly artifact: ArtifactObject
	  }

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Read the version an artifact declares, or the one the caller names for it. */
function sourceVersion(artifact: ArtifactObject, from: SchemaVersion | undefined): { version: SchemaVersion; declared: boolean } {
	const address = artifact.$schema
	if (address === undefined) {
		if (from) return { version: from, declared: false }
		throw new SchemaMigrationError(
			'missing-version',
			`The artifact has no $schema. Name its version with paradoc migrate --from <version>; the current version is ${SCHEMA_VERSION}.`,
		)
	}
	const read = typeof address === 'string' ? readSchemaAddress(address) : ({ kind: 'foreign' } as const)
	if (read.kind === 'known') {
		if (from && from !== read.version) {
			throw new SchemaMigrationError(
				'version-conflict',
				`$schema declares ${read.version}, but ${from} was named as the source version.`,
			)
		}
		return { version: read.version, declared: true }
	}
	// Any other address names no published version, so the caller must.
	if (from) return { version: from, declared: false }
	switch (read.kind) {
		case 'undated':
			throw new SchemaMigrationError(
				'missing-version',
				`$schema ${String(address)} names no schema version. Name its version with paradoc migrate --from <version>; the current version is ${SCHEMA_VERSION}.`,
			)
		case 'unknown-version':
			throw new SchemaMigrationError(
				'unknown-version',
				`$schema names schema version ${read.version}, which does not exist. Known versions: ${SCHEMA_VERSIONS.join(', ')}; name the right one with paradoc migrate --from <version>.`,
			)
		case 'foreign':
			throw new SchemaMigrationError(
				'unknown-version',
				`$schema ${JSON.stringify(address)} is not a Paradoc schema address. Name its version with paradoc migrate --from <version>.`,
			)
	}
}

/** The ordered steps from one version to the current one. */
function stepsFrom(version: SchemaVersion, steps: readonly MigrationStep[]): MigrationStep[] {
	const chain: MigrationStep[] = []
	for (let index = SCHEMA_VERSIONS.indexOf(version); index < SCHEMA_VERSIONS.length - 1; index++) {
		const from = SCHEMA_VERSIONS[index] as SchemaVersion
		const to = SCHEMA_VERSIONS[index + 1] as SchemaVersion
		const step = steps.find((candidate) => candidate.from === from && candidate.to === to)
		if (!step) {
			throw new SchemaMigrationError('no-migration-path', `No migration step leads from schema version ${from} to ${to}.`)
		}
		chain.push(step)
	}
	return chain
}

/** Point `$schema` at the current version: first on the root, kept in place on nested inline artifacts. */
function stampCurrentVersion(artifact: ArtifactObject): ArtifactObject {
	const contents = artifact.contents
	if (artifact.kind === 'bundle' && Array.isArray(contents)) {
		for (const item of contents) {
			if (isObject(item) && item.type === 'inline' && isObject(item.artifact) && item.artifact.$schema !== undefined) {
				item.artifact.$schema = PARADOC_SCHEMA_URL
			}
		}
	}
	const { $schema: _previous, ...rest } = artifact
	return { $schema: PARADOC_SCHEMA_URL, ...rest }
}

/**
 * Migrate a parsed artifact to the current schema version.
 *
 * Applies every step from the artifact's version to the current one, in
 * order, and writes the current dated `$schema`. The input is never changed.
 * Fails with `SchemaMigrationError` when the version cannot be read, a step
 * cannot convert a value, or the result does not validate.
 */
export function migrateArtifact(input: unknown, options: MigrateOptions = {}): ArtifactMigration {
	if (!isObject(input) || typeof input.kind !== 'string') {
		throw new SchemaMigrationError('not-an-artifact', 'Expected an artifact: an object with a "kind".')
	}
	const { version, declared } = sourceVersion(input, options.from)
	if (version === SCHEMA_VERSION && declared) {
		return { status: 'current', version, artifact: input }
	}

	const chain = stepsFrom(version, options.steps ?? MIGRATION_STEPS)
	let artifact = deepClone(input)
	try {
		for (const step of chain) artifact = step.apply(artifact)
	} catch (error) {
		if (error instanceof UnconvertibleValueError) throw new SchemaMigrationError('unconvertible-value', error.message)
		throw error
	}
	artifact = stampCurrentVersion(artifact)

	const result = validate(artifact)
	if (result.issues) {
		const details = result.issues
			.map((issue) => {
				const path = issue.path?.length ? issue.path.map((part) => (typeof part === 'object' ? String(part.key) : String(part))).join('.') : '(root)'
				return `${path}: ${issue.message}`
			})
			.join('; ')
		throw new SchemaMigrationError(
			'invalid-result',
			`The artifact migrated to ${SCHEMA_VERSION} does not validate: ${details}`,
		)
	}

	return { status: 'migrated', from: version, to: SCHEMA_VERSION, steps: chain, artifact }
}

// ============================================================================
// Files
// ============================================================================

export type ArtifactSourceFormat = 'json' | 'yaml'

export interface MigrateSourceOptions extends MigrateOptions {
	/** The content's format. Detected when omitted: JSON first, then YAML. */
	format?: ArtifactSourceFormat
}

/** The outcome of migrating one artifact file's content. */
export type ArtifactSourceMigration =
	| { readonly status: 'current'; readonly version: SchemaVersion; readonly content: string }
	| {
			readonly status: 'migrated'
			readonly from: SchemaVersion
			readonly to: SchemaVersion
			readonly steps: readonly MigrationStep[]
			/** The rewritten content, in the same format as the input. */
			readonly content: string
	  }

function parseSource(content: string, format: ArtifactSourceFormat | undefined): { value: unknown; document?: Document } {
	if (format !== 'yaml') {
		try {
			return { value: JSON.parse(content) }
		} catch (error) {
			if (format === 'json') {
				throw new SchemaMigrationError('unparseable', `The file is not valid JSON: ${(error as Error).message}`)
			}
		}
	}
	const document = parseDocument(content)
	if (document.errors.length > 0) {
		const reason = document.errors[0]?.message ?? 'unknown error'
		throw new SchemaMigrationError('unparseable', `The file is not valid ${format === 'yaml' ? 'YAML' : 'JSON or YAML'}: ${reason}`)
	}
	return { value: document.toJS(), document }
}

function deepEqual(left: unknown, right: unknown): boolean {
	if (left === right) return true
	if (Array.isArray(left) && Array.isArray(right)) {
		return left.length === right.length && left.every((value, index) => deepEqual(value, right[index]))
	}
	if (isObject(left) && isObject(right)) {
		const keys = Object.keys(left)
		return keys.length === Object.keys(right).length && keys.every((key) => key in right && deepEqual(left[key], right[key]))
	}
	return false
}

/** Apply the difference between two values to a YAML document, keeping its comments and layout. */
function patchYaml(document: Document, path: (string | number)[], before: unknown, after: unknown): void {
	if (isObject(before) && isObject(after)) {
		for (const key of Object.keys(before)) if (!(key in after)) document.deleteIn([...path, key])
		for (const [key, value] of Object.entries(after)) {
			if (key in before) patchYaml(document, [...path, key], before[key], value)
			else document.setIn([...path, key], document.createNode(value))
		}
		return
	}
	if (Array.isArray(before) && Array.isArray(after) && before.length === after.length) {
		after.forEach((value, index) => patchYaml(document, [...path, index], before[index], value))
		return
	}
	if (deepEqual(before, after)) return
	const node = document.getIn(path, true)
	// A changed scalar keeps its node, so its comments and quoting survive.
	if (isScalar(node) && (after === null || typeof after !== 'object')) node.value = after
	else document.setIn(path, document.createNode(after))
}

/** The editor's schema comment, pointed at a Paradoc schema address. */
const LANGUAGE_SERVER_SCHEMA = /^(#\s*yaml-language-server:\s*\$schema=)https:\/\/schema\.paradoc\.dev\/\S+/m

function writeYaml(document: Document, before: unknown, after: ArtifactObject): string {
	patchYaml(document, [], before, after)
	const root = document.contents
	if (isMap(root)) {
		const index = root.items.findIndex((pair) => (isScalar(pair.key) ? pair.key.value : pair.key) === '$schema')
		const [pair] = index > 0 ? root.items.splice(index, 1) : []
		const first = root.items[0]
		if (pair && first) {
			// A comment above the first key heads the file; it stays above $schema.
			const key = isScalar(pair.key) ? pair.key : document.createNode(pair.key)
			if (isScalar(first.key) && first.key.commentBefore) {
				key.commentBefore = first.key.commentBefore
				first.key.commentBefore = undefined
			}
			pair.key = key
			root.items.unshift(pair)
		}
	}
	return document.toString().replace(LANGUAGE_SERVER_SCHEMA, `$1${PARADOC_SCHEMA_URL}`)
}

function writeJson(original: string, after: ArtifactObject): string {
	const indent = /^([ \t]+)"/m.exec(original)?.[1] ?? 2
	const text = JSON.stringify(after, null, indent)
	return original.endsWith('\n') ? `${text}\n` : text
}

/**
 * Migrate an artifact file's content to the current schema version.
 *
 * The result keeps the input's format: JSON keeps its indentation, and YAML
 * keeps its comments and layout apart from the values that change.
 */
export function migrateArtifactSource(content: string, options: MigrateSourceOptions = {}): ArtifactSourceMigration {
	const parsed = parseSource(content, options.format)
	const migration = migrateArtifact(parsed.value, options)
	if (migration.status === 'current') return { status: 'current', version: migration.version, content }
	const rewritten = parsed.document
		? writeYaml(parsed.document, parsed.value, migration.artifact)
		: writeJson(content, migration.artifact)
	return { status: 'migrated', from: migration.from, to: migration.to, steps: migration.steps, content: rewritten }
}
