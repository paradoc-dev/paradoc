import kleur from "kleur";
import { toYAML } from "@paradoc/core";
import { LocalFileSystem } from "./local-fs.js";

export interface WriteOptions {
	dryRun?: boolean;
	format?: "json" | "yaml";
}

/**
 * Write content to a file
 * @param filePath - Path to write to
 * @param content - Content to write (will be serialized with schema)
 * @param options - Write options
 */
export async function writeFile(
	filePath: string,
	content: unknown,
	options: WriteOptions = {},
): Promise<void> {
	const { dryRun = false, format = "json" } = options;

	const storage = new LocalFileSystem();

	// Format content using serializers
	let formattedContent: string;
	if (format === "yaml") {
		formattedContent = toYAML(content);
	} else {
		formattedContent = JSON.stringify(content, null, 2) + "\n";
	}

	if (dryRun) {
		console.log();
		console.log(kleur.yellow("Dry run mode - file not created:"));
		console.log(kleur.gray(`  Path: ${filePath}`));
		console.log();
		console.log(kleur.dim("Content:"));
		console.log(kleur.dim(formattedContent));
		console.log();
	} else {
		// storage.writeFile automatically creates parent directories
		await storage.writeFile(filePath, formattedContent);
		console.log();
		console.log(kleur.green(`✓ Created ${format.toUpperCase()} file:`));
		console.log(kleur.gray(`  ${filePath}`));
		console.log();
	}
}

/**
 * Show artifact details after creation
 * @param artifact - The created artifact
 */
export function showArtifactDetails(artifact: {
	name: string;
	title: string;
	kind: string;
}): void {
	console.log(kleur.gray("Details:"));
	console.log(kleur.gray(`  Slug:  ${artifact.name}`));
	console.log(kleur.gray(`  Title: ${artifact.title}`));
	console.log(kleur.gray(`  Kind:  ${artifact.kind}`));
	console.log();
}
