import slugifyLib from "slugify";

export type ArtifactType =
	| "form"
	| "document"
	| "checklist"
	| "bundle";

/**
 * Generate a slug for an artifact
 * @param name - The name of the artifact
 * @param _type - The type of artifact (no longer used, kept for backward compatibility)
 * @returns A slugified name without type suffix
 */
export function generateSlug(name: string, _type?: ArtifactType): string {
	const slug = slugifyLib(name, {
		lower: true,
		strict: true,
		trim: true,
	});
	return slug;
}

/**
 * Generate a filename for an artifact
 * @param slug - The slug of the artifact (can include type suffix like "my-form.form")
 * @param format - The output format (json or yaml)
 * @returns A filename with appropriate extension
 */
export function generateFilename(
	slug: string,
	format: "json" | "yaml" = "json",
): string {
	return `${slug}.${format}`;
}

/**
 * Extract the base slug (removes artifact type suffix)
 * @param slug - The full slug with type (e.g., "my-form.form")
 * @returns The base slug without type (e.g., "my-form")
 */
export function getBaseSlug(slug: string): string {
	// Remove the artifact type suffix (last dot and following word)
	const parts = slug.split(".");
	if (parts.length > 1) {
		// Remove the last part (the type)
		return parts.slice(0, -1).join(".");
	}
	return slug;
}
