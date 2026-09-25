import slugifyLib from "slugify";

/**
 * Generate a slug for an artifact
 * @param name - The name of the artifact
 * @returns A slugified name without type suffix
 */
export function generateSlug(name: string): string {
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
