import { Command } from "commander";
import { createFormCommand } from "./form.js";
import { createDocumentCommand } from "./document.js";
import { createChecklistCommand } from "./checklist.js";
import { createBundleCommand } from "./bundle.js";

/**
 * Create the 'new' command group
 * Contains subcommands for creating different artifact types
 */
export function createNewCommand(): Command {
	const newCmd = new Command("new");

	newCmd.description("Create new Paradoc artifacts");

	// Add all artifact subcommands
	newCmd.addCommand(createFormCommand());
	newCmd.addCommand(createDocumentCommand());
	newCmd.addCommand(createChecklistCommand());
	newCmd.addCommand(createBundleCommand());

	return newCmd;
}

// Re-export types for external use
export type { FormOptions } from "./form.js";
export type { DocumentOptions } from "./document.js";
export type { ChecklistOptions } from "./checklist.js";
export type { BundleOptions } from "./bundle.js";
