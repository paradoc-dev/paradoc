import { Command } from "commander";
import kleur from "kleur";
import { LocalFileSystem } from "../../utils/local-fs.js";
import prompts from "prompts";
import { generateSlug, generateFilename } from "../../utils/slugify.js";
import { generateDocumentTemplate } from "../../utils/templates.js";
import { writeFile, showArtifactDetails } from "../../utils/file-writer.js";

export interface DocumentOptions {
	yes?: boolean;
	slug?: string;
	title?: string;
	description?: string;
	code?: string;
	artifactVersion?: string;
	dir?: string;
	dryRun?: boolean;
	format?: "json" | "yaml";
}

/**
 * Implementation function to create a new document artifact
 * @param name - Name of the document
 * @param options - Document creation options
 */
async function createDocumentImpl(
	name: string,
	options: DocumentOptions = {},
): Promise<void> {
	const {
		yes = false,
		slug,
		title,
		description,
		code,
		artifactVersion: version,
		dir,
		dryRun = false,
		format = "json",
	} = options;

	// Gather artifact configuration
	let artifactTitle: string;
	let artifactSlug: string;
	let artifactDescription: string | undefined;
	let artifactCode: string | undefined;
	let artifactVersion: string;
	let artifactFormat: "json" | "yaml";
	let outputDir = dir || ".";

	// Auto-generated defaults
	const defaultTitle = name
		.split(/[-_]/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
	const defaultSlug = generateSlug(name, "document");

	try {
		if (!yes) {
			// Interactive mode
			console.log();
			console.log(kleur.bold("Create Document"));
			console.log();

			// Prompt for title
			const { title: inputTitle } = await prompts({
				type: "text",
				name: "title",
				message: "Title:",
				initial: title || defaultTitle,
				validate: (val: string) => val.trim().length > 0 || "Title is required",
			});
			if (!inputTitle) throw new Error("User force closed the prompt");
			artifactTitle = inputTitle.trim();

			// Prompt for slug
			const { slug: inputSlug } = await prompts({
				type: "text",
				name: "slug",
				message: "Slug:",
				initial: slug || defaultSlug,
				validate: (val: string) => {
					if (!val.trim()) return "Slug is required";
					if (!/^[a-z0-9-]+$/.test(val)) return "Slug must be lowercase letters, numbers, and hyphens only";
					return true;
				},
			});
			if (!inputSlug) throw new Error("User force closed the prompt");
			artifactSlug = inputSlug.trim();

			// Prompt for description
			const { description: inputDescription } = await prompts({
				type: "text",
				name: "description",
				message: "Description (optional):",
				initial: description || "",
			});
			artifactDescription = inputDescription?.trim() || undefined;

			// Prompt for code
			const { code: inputCode } = await prompts({
				type: "text",
				name: "code",
				message: "Code/reference (optional):",
				initial: code || "",
			});
			artifactCode = inputCode?.trim() || undefined;

			// Prompt for version
			const { version: inputVersion } = await prompts({
				type: "text",
				name: "version",
				message: "Version:",
				initial: version || "1.0.0",
			});
			if (!inputVersion) throw new Error("User force closed the prompt");
			artifactVersion = inputVersion.trim();

			// Prompt for format
			const { format: inputFormat } = await prompts({
				type: "select",
				name: "format",
				message: "Format:",
				choices: [
					{ value: "json" as const, title: "json" },
					{ value: "yaml" as const, title: "yaml" },
				],
				initial: format === "yaml" ? 1 : 0,
			});
			if (inputFormat === undefined) throw new Error("User force closed the prompt");
			artifactFormat = inputFormat;

			// Prompt for output directory
			const { dir: inputDir } = await prompts({
				type: "text",
				name: "dir",
				message: `Where would you like to save this document? ${kleur.gray(`(${artifactSlug} or . for current)`)}:`,
				initial: ".",
				validate: (val: string) => val.trim().length > 0 || "Directory is required",
			});
			if (!inputDir) throw new Error("User force closed the prompt");
			outputDir = inputDir.trim();
		} else {
			// Non-interactive mode - use flags or defaults
			artifactTitle = title || defaultTitle;
			artifactSlug = slug || defaultSlug;
			artifactDescription = description;
			artifactCode = code;
			artifactVersion = version || "1.0.0";
			artifactFormat = format;
		}
	} catch (error: any) {
		// Handle user cancellation (Ctrl+C)
		if (error.message?.includes("force closed") || error.message?.includes("User force closed")) {
			console.log();
			console.log(kleur.yellow("Cancelled."));
			console.log();
			process.exit(0);
		}
		throw error;
	}

	// File writing
	const storage = new LocalFileSystem();
	const projectRoot = process.cwd();

	// Generate template
	const template = generateDocumentTemplate(artifactSlug, artifactTitle, {
		description: artifactDescription,
		code: artifactCode,
		version: artifactVersion,
	});

	// Write file using slug
	const filename = generateFilename(artifactSlug, artifactFormat);
	const filePath = storage.joinPath(projectRoot, outputDir, filename);

	await writeFile(filePath, template, { dryRun, format: artifactFormat });
	if (!dryRun) {
		showArtifactDetails(template);
	}
}

/**
 * Create the 'document' subcommand
 */
export function createDocumentCommand(): Command {
	const document = new Command("document");

	document
		.argument("<name>", "Name of the document")
		.description("Create a new document")
		.option("-y, --yes", "Non-interactive mode (skip prompts)")
		.option("--slug <slug>", "Override auto-generated slug")
		.option("--title <title>", "Human-readable title")
		.option("--description <desc>", "Description")
		.option("--code <code>", "Code/reference")
		.option("--artifact-version <version>", "Version (default: 1.0.0)")
		.option("--dir <path>", "Custom output directory")
		.option("--dry-run", "Preview without creating files")
		.option("--format <format>", "Output format (json|yaml)", "json")
		.action(async (name: string, options: DocumentOptions) => {
			await createDocumentImpl(name, options);
		});

	return document;
}
