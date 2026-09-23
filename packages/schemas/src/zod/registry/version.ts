/**
 * Registry artifact version pattern
 *
 * A full SemVer 2.0.0 version, anchored at both ends. Prerelease and build
 * metadata are allowed; leading zeros and trailing text are not. This is the
 * same rule the Paradoc registry enforces when an artifact is published.
 */
export const REGISTRY_VERSION_PATTERN =
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
