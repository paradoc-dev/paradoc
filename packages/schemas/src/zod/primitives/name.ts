/**
 * Artifact name pattern
 *
 * Letters and digits, with single hyphens between them: no leading, trailing
 * or consecutive hyphens, and no underscores. It is the one name rule for
 * artifacts, registry index entries, registry items and lock file references,
 * so a registry can never list a name that core refuses to load.
 */
export const ARTIFACT_NAME_PATTERN = /^[A-Za-z0-9]([A-Za-z0-9]|-[A-Za-z0-9])*$/;

/**
 * Registry namespace pattern
 *
 * An `@` followed by a letter or digit, then letters, digits, hyphens or
 * underscores. It is the one namespace rule for the project manifest, the
 * global config and artifact references.
 */
export const REGISTRY_NAMESPACE_PATTERN = /^@[a-zA-Z0-9][a-zA-Z0-9-_]*$/;

/** A direct-URL install's namespace: `@` and the URL's lowercase hostname. */
const HOSTNAME_NAMESPACE_SOURCE = '@[a-z0-9-]+(?:\\.[a-z0-9-]+)+';

const unanchored = (pattern: RegExp) => pattern.source.slice(1, -1);

/**
 * Installed artifact reference pattern (`@namespace/name`), the key of each
 * lock file entry. The namespace is a registry namespace, or `@<hostname>` for
 * an artifact added by direct URL; the name follows the artifact name rule.
 */
export const ARTIFACT_REFERENCE_PATTERN = new RegExp(
	`^(?:${unanchored(REGISTRY_NAMESPACE_PATTERN)}|${HOSTNAME_NAMESPACE_SOURCE})/${unanchored(ARTIFACT_NAME_PATTERN)}$`,
);
