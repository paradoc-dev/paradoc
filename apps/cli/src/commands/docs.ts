import { Command } from "commander";
import kleur from "kleur";
import open from "open";

/**
 * Create the 'docs' command
 * Opens the Paradoc documentation in browser
 */
export function createDocsCommand(): Command {
	const docs = new Command("docs");

	docs
		.description("Open Paradoc documentation in browser")
		.action(async () => {
			console.log(kleur.gray("Opening Paradoc documentation..."));
			await open("https://docs.paradoc.dev");
		});

	return docs;
}
