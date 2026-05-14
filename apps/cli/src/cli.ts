import { Command } from 'commander'
import kleur from 'kleur'
import { initProxy } from './utils/proxy.js'
import { checkForUpdate, printUpdateNotice } from './utils/update-notifier.js'
import { brandColorBold, VERSION } from './constants.js'
import { configureGroupedHelp, type CommandGroup } from './utils/help-formatter.js'
import { commandEntries } from './command-map.js'

// Configure proxy from env vars before any fetch calls
initProxy()

// Fire-and-forget update check (non-blocking, respects proxy)
checkForUpdate()

const program = new Command()

program
	.name('para')
	.description(brandColorBold('Paradoc CLI') + kleur.gray(' — Registry-first artifact manager'))
	.version(VERSION, '-v, --version', 'Display version number')
	.helpOption('-h, --help', 'Display help for command')
	.option('--no-telemetry', 'Disable telemetry for this invocation')

const args = process.argv.slice(2)
const firstPositional = args.find(a => !a.startsWith('-'))

// Look up command by name or alias
const entry = firstPositional
	? commandEntries.find(e => e.name === firstPositional || e.aliases?.includes(firstPositional))
	: null

if (entry) {
	// Load only the requested command
	const cmd = await entry.load()
	program.addCommand(cmd)
} else if (!firstPositional) {
	// No command specified — build lightweight stubs for help display
	const groupOrder = ['Registry', 'Artifacts', 'Project', 'Settings'] as const
	const groupMap = new Map<string, Command[]>()

	for (const e of commandEntries) {
		const stub = new Command(e.name).description(e.description)
		if (e.aliases) for (const a of e.aliases) stub.alias(a)
		program.addCommand(stub)
		const list = groupMap.get(e.group) ?? []
		list.push(stub)
		groupMap.set(e.group, list)
	}

	const commandGroups: CommandGroup[] = groupOrder
		.filter(g => groupMap.has(g))
		.map(g => ({ name: g, commands: groupMap.get(g)! }))

	configureGroupedHelp(program, commandGroups)
}

// Handle unknown commands
program.on('command:*', (operands) => {
	console.error(kleur.red(`error: unknown command '${operands[0]}'`))
	console.log()
	console.log(
		kleur.gray(
			`Run ${kleur.white('para -h')} to see a list of available commands.`,
		),
	)
	process.exit(1)
})

// Bridge --no-telemetry flag to env var before commands run
program.hook('preAction', () => {
	if (program.opts().telemetry === false) {
		process.env.OFM_TELEMETRY_DISABLED = '1'
	}
})

// Parse arguments
program.parse(process.argv)

// Print update notice (sync, reads cached result from checkForUpdate)
printUpdateNotice()

// If no arguments are provided, show help
if (!args.length) {
	program.outputHelp()
}
