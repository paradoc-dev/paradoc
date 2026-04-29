import { Command } from "commander";
import kleur from "kleur";
import open from "open";

/**
 * Create the 'console' command
 * Opens the Paradoc web console in browser
 */
export function createConsoleCommand(): Command {
	const consoleCmd = new Command("console");

	consoleCmd
		.description("Open Paradoc web console in browser")
		.action(async () => {
			console.log(kleur.gray("Opening Paradoc console..."));
			await open("https://paradoc.dev");
		});

	return consoleCmd;
}
