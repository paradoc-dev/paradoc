import { Command } from 'commander'
import { createTemplateCommand } from './template.js'
import { createValidateCommand } from './validate.js'
import { createFillCommand } from './fill.js'

/**
 * Create the 'data' command group
 * Contains subcommands for data operations
 */
export function createDataCommand(): Command {
	const dataCmd = new Command('data')

	dataCmd.description('Data operations for Paradoc artifacts')

	// Add all data subcommands
	dataCmd.addCommand(createTemplateCommand())
	dataCmd.addCommand(createValidateCommand())
	dataCmd.addCommand(createFillCommand())

	return dataCmd
}

