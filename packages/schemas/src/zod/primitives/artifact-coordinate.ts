import { ARTIFACT_VERSION_PATTERN } from './version';

/**
 * Artifact coordinates
 *
 * A coordinate addresses a registry artifact by its hierarchy: org, repo,
 * form, edition, then version. The artifact is always the first three segments;
 * the edition, when named, is the fourth; the version follows `@`. The
 * leading `@` is optional.
 *
 * - `@org/repo/w-9` is the current edition, latest version.
 * - `@org/repo/w-9/2024-03` is the latest version of edition 2024-03.
 * - `@org/repo/w-9/2024-03@1.0.0` pins one edition and one version.
 * - `@org/repo/w-9/current@1.0.0` is version 1.0.0 of the current edition,
 *   as is `@org/repo/w-9@1.0.0`.
 *
 * `current` names the current edition and `latest` the latest version, so
 * `@org/repo/w-9/current@latest` is the same as `@org/repo/w-9`. A registry
 * URL is the same path with the version as its own segment:
 * `/registry/org/repo/w-9/2024-03/1.0.0`.
 *
 * It is the coordinate grammar of the platform registry: bundle registry
 * items, the SDK and the platform services use it. The CLI's file registries
 * (`add`, the catalog and the lock) do not: they name an artifact as
 * `@ns/name` and have no editions.
 */

/**
 * One segment of a coordinate path: an org, a repo or an artifact name.
 * Lowercase letters and digits with single hyphens between them, the
 * platform's slug rule.
 */
const SEGMENT_SOURCE = '[a-z0-9](?:[a-z0-9]|-[a-z0-9])*';

/** The edition selector for the artifact's current edition. */
export const CURRENT_EDITION = 'current';

/** The version selector for an edition's latest version. */
export const LATEST_VERSION = 'latest';

/**
 * Words an edition key may not be. `current` and `latest` are selectors;
 * `editions`, `tags` and `diff` name what follows an artifact in a registry
 * coordinate or URL (`@org/repo/w-9/editions`), so a key equal to one of
 * them could not be told apart from it.
 */
export const RESERVED_EDITION_KEYS = ['current', 'latest', 'editions', 'tags', 'diff'] as const;

/** Whether a string is one of the reserved words an edition key may not be. */
export function isReservedEditionKey(value: string): boolean {
	return (RESERVED_EDITION_KEYS as readonly string[]).includes(value);
}

/**
 * Edition key pattern
 *
 * Lowercase letters and digits with single hyphens between them, such as
 * `2024-03` or `3b`. An edition key is unique among the editions of one artifact,
 * is the edition segment of a coordinate, and is never one of
 * `RESERVED_EDITION_KEYS`. It never contains a dot, so it can never be
 * mistaken for a version.
 */
export const EDITION_KEY_PATTERN = /^[a-z0-9]([a-z0-9]|-[a-z0-9])*$/;

/** The longest edition key. */
export const EDITION_KEY_MAX_LENGTH = 64;

/**
 * Edition key pattern for schemas: `EDITION_KEY_PATTERN` that also refuses
 * the reserved words, so exported JSON Schema enforces them too.
 */
export const EDITION_KEY_SCHEMA_PATTERN = new RegExp(
	`^(?!(?:${RESERVED_EDITION_KEYS.join('|')})$)${EDITION_KEY_PATTERN.source.slice(1)}`,
);

const unanchored = (pattern: RegExp) => pattern.source.slice(1, -1);

const ADDRESS_SOURCE = `@?${SEGMENT_SOURCE}/${SEGMENT_SOURCE}/${SEGMENT_SOURCE}`;
const VERSION_SOURCE = `${LATEST_VERSION}|${unanchored(ARTIFACT_VERSION_PATTERN)}`;

/**
 * The edition position of a coordinate: an edition key of at most
 * `EDITION_KEY_MAX_LENGTH` characters that is not a reserved word, or the
 * selector `current`. The lookaheads end at the `@` of a version or at the
 * end of the coordinate.
 */
const EDITION_SOURCE = [
	`(?!(?:${RESERVED_EDITION_KEYS.filter((key) => key !== CURRENT_EDITION).join('|')})(?:@|$))`,
	`(?=[a-z0-9-]{1,${EDITION_KEY_MAX_LENGTH}}(?:@|$))`,
	unanchored(EDITION_KEY_PATTERN),
].join('');

/**
 * An artifact address with no edition and no version: `@org/repo/name`. The
 * exported patterns use no named groups, so JSON Schema validators in other
 * languages accept them.
 */
export const ARTIFACT_ADDRESS_PATTERN = new RegExp(`^${ADDRESS_SOURCE}$`);

/**
 * A full coordinate: `@org/repo/name`, an optional `/edition` (a key or
 * `current`), and an optional `@version` (a SemVer version or `latest`). It
 * accepts exactly the strings `parseArtifactCoordinate` parses.
 */
export const ARTIFACT_COORDINATE_PATTERN = new RegExp(
	`^${ADDRESS_SOURCE}(?:/(?:${EDITION_SOURCE}))?(?:@(?:${VERSION_SOURCE}))?$`,
);

/** The coordinate pattern with named parts, for parsing only. */
const COORDINATE_PARTS = new RegExp(
	`^@?(?<org>${SEGMENT_SOURCE})/(?<repo>${SEGMENT_SOURCE})/(?<name>${SEGMENT_SOURCE})(?:/(?<edition>${EDITION_SOURCE}))?(?:@(?<version>${VERSION_SOURCE}))?$`,
);

/** The parts of an artifact coordinate. */
export interface ArtifactCoordinate {
	readonly org: string;
	readonly repo: string;
	readonly name: string;
	/** An edition key. Omitted: the artifact's current edition. */
	readonly edition?: string;
	/** A SemVer version. Omitted: the latest version of the edition. */
	readonly version?: string;
}

/**
 * Parse a coordinate into its parts, or `undefined` when it is not one. The
 * selectors `current` and `latest` parse to an omitted edition and version.
 * A reserved word other than `current` in the edition position is not a
 * coordinate.
 */
export function parseArtifactCoordinate(value: string): ArtifactCoordinate | undefined {
	const match = COORDINATE_PARTS.exec(value);
	if (!match) return undefined;
	const { org, repo, name, edition, version } = match.groups as {
		org: string;
		repo: string;
		name: string;
		edition?: string;
		version?: string;
	};
	if (edition !== undefined && edition !== CURRENT_EDITION && isReservedEditionKey(edition)) return undefined;
	if (edition !== undefined && edition.length > EDITION_KEY_MAX_LENGTH) return undefined;
	return {
		org,
		repo,
		name,
		...(edition !== undefined && edition !== CURRENT_EDITION && { edition }),
		...(version !== undefined && version !== LATEST_VERSION && { version }),
	};
}

/**
 * Format coordinate parts as `@org/repo/name[/edition][@version]`. Parts that
 * are omitted stay omitted: the selectors `current` and `latest` are never
 * written, so a formatted coordinate names only what it was given.
 */
export function formatArtifactCoordinate(coordinate: ArtifactCoordinate): string {
	const edition = coordinate.edition === undefined ? '' : `/${coordinate.edition}`;
	const version = coordinate.version === undefined ? '' : `@${coordinate.version}`;
	return `@${coordinate.org}/${coordinate.repo}/${coordinate.name}${edition}${version}`;
}

/**
 * Whether a string can stand in the edition position of a coordinate or a
 * registry path: an edition key, or the selector `current`.
 */
export function isEditionSelector(value: string): boolean {
	return (
		value === CURRENT_EDITION ||
		(value.length <= EDITION_KEY_MAX_LENGTH && EDITION_KEY_PATTERN.test(value) && !isReservedEditionKey(value))
	);
}

/**
 * Whether a string can stand in the version position: an exact SemVer
 * version, or the selector `latest`.
 */
export function isVersionSelector(value: string): boolean {
	return value === LATEST_VERSION || ARTIFACT_VERSION_PATTERN.test(value);
}
