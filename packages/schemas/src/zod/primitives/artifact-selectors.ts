import { z } from 'zod';
import {
	ARTIFACT_COORDINATE_PATTERN,
	EDITION_KEY_MAX_LENGTH,
	EDITION_KEY_SCHEMA_PATTERN,
	RESERVED_EDITION_KEYS,
	isEditionSelector,
	isVersionSelector,
} from './artifact-coordinate';

/**
 * An edition key as a field of its own: lowercase letters and digits with
 * single hyphens, never a reserved word.
 */
export const EditionKeySchema = z
	.string()
	.min(1)
	.max(EDITION_KEY_MAX_LENGTH)
	.regex(
		EDITION_KEY_SCHEMA_PATTERN,
		`Expected an edition key: lowercase letters and digits with single hyphens, such as 2024-03, and not one of ${RESERVED_EDITION_KEYS.join(', ')}`,
	);

/**
 * The edition a request names, as a field of its own: an edition key, or
 * `current` for the artifact's current edition. `current` means the same as
 * leaving the field out.
 */
export const EditionSelectorSchema = z
	.string()
	.max(EDITION_KEY_MAX_LENGTH)
	.refine(isEditionSelector, "Expected an edition key, such as 2024-03, or 'current'");

/**
 * The version a request names, as a field of its own: an exact SemVer
 * version, or `latest` for the edition's latest version. `latest` means the
 * same as leaving the field out.
 */
export const VersionSelectorSchema = z
	.string()
	.max(200)
	.refine(isVersionSelector, "Expected a version, such as 1.2.0, or 'latest'");

/**
 * A registry coordinate as a field of its own:
 * `@org/repo/name[/edition][@version]`, leading `@` optional. The pattern
 * accepts exactly what `parseArtifactCoordinate` parses, so exported JSON
 * Schema enforces the whole grammar.
 */
export const ArtifactCoordinateSchema = z
	.string()
	.regex(
		ARTIFACT_COORDINATE_PATTERN,
		'Expected a registry coordinate such as @org/repo/name, @org/repo/name/2024-03 or @org/repo/name/2024-03@1.0.0',
	);
