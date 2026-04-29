import { Command } from "commander";
import kleur from "kleur";
import { LocalFileSystem } from "../../utils/local-fs.js";
import prompts from "prompts";
import { generateSlug, generateFilename } from "../../utils/slugify.js";
import {
	generateFormTemplate,
	parseFieldDefinition,
	createField,
} from "../../utils/templates.js";
import { writeFile, showArtifactDetails } from "../../utils/file-writer.js";
import { collect } from "../../utils/cli-helpers.js";

export interface FormOptions {
	yes?: boolean;
	slug?: string;
	title?: string;
	description?: string;
	code?: string;
	artifactVersion?: string;
	dir?: string;
	field?: string[];
	dryRun?: boolean;
	format?: "json" | "yaml";
}

/**
 * Implementation function to create a new form artifact
 * @param name - Name of the form
 * @param options - Form creation options
 */
async function createFormImpl(
	name: string,
	options: FormOptions = {},
): Promise<void> {
	const {
		yes = false,
		slug,
		title,
		description,
		code,
		artifactVersion: version,
		dir,
		field = [],
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
	const defaultSlug = generateSlug(name, "form");

	try {
		if (!yes) {
			// Interactive mode
			console.log();
			console.log(kleur.bold("Create Form"));
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
				message: `Where would you like to save this form? ${kleur.gray(`(${artifactSlug} or . for current)`)}:`,
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

	// Parse fields
	const fields: Record<string, unknown> = {};
	for (const fieldDef of field) {
		const { name: fieldName, type } = parseFieldDefinition(fieldDef);
		fields[fieldName] = createField(fieldName, type);
	}

	// Generate template
	const template = generateFormTemplate(artifactSlug, artifactTitle, {
		description: artifactDescription,
		code: artifactCode,
		version: artifactVersion,
		fields,
	});

	// Write file using slug (now without artifact type)
	const filename = generateFilename(artifactSlug, artifactFormat);
	const filePath = storage.joinPath(projectRoot, outputDir, filename);

	await writeFile(filePath, template, { dryRun, format: artifactFormat });
	if (!dryRun) {
		showArtifactDetails(template);
	}
}

/**
 * Create the 'form' subcommand
 */
export function createFormCommand(): Command {
	const form = new Command("form");

	form
		.argument("<name>", "Name of the form")
		.description("Create a new form")
		.option("-y, --yes", "Non-interactive mode (skip prompts)")
		.option("--slug <slug>", "Override auto-generated slug")
		.option("--title <title>", "Human-readable title")
		.option("--description <desc>", "Description")
		.option("--code <code>", "Code/reference")
		.option("--artifact-version <version>", "Version (default: 1.0.0)")
		.option("--dir <path>", "Custom output directory")
		.option("--field <name:type>", "Add field (repeatable)", collect, [])
		.option("--dry-run", "Preview without creating files")
		.option("--format <format>", "Output format (json|yaml)", "json")
		.action(async (name: string, options: FormOptions) => {
			await createFormImpl(name, options);
		});

	return form;
}
