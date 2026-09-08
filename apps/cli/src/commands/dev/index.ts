/**
 * `para dev` — every composition in the project, live, beside its PDF.
 *
 * The command itself is thin: find the compositions, print what was found, and
 * hand the rest to the dev server. `--list` stops after the printing, which is
 * how a project checks that its conventions are being read the way it expects
 * without starting anything.
 */

import { Command } from 'commander'
import kleur from 'kleur'

import { loadDiscovery, type DiscoveredComposition } from './discovery.js'
import { bindingLabel, sampleLabel } from './messages.js'
import { assertDevPeers, MissingDevPeerError } from './peers.js'

interface DevOptions {
	port: string
	host: string
	open?: boolean
	list?: boolean
	json?: boolean
}

/** The default port. One below the lab's, so both can run at once. */
const DEFAULT_PORT = '5180'

/** What `para dev` previews, in the words the conventions are documented in. */
const NOTHING_FOUND =
	'No compositions found. para dev previews every .tsx or .jsx file under a compositions/ ' +
	'directory, bound to the artifact whose file layer of MIME type text/tsx or text/jsx names it.'

export function createDevCommand(): Command {
	const dev = new Command('dev')

	dev
		.argument('[dir]', 'Project directory (defaults to the working directory)')
		.description('Preview compositions live with their sample data and a proof PDF')
		.option('--port <number>', 'Port to listen on', DEFAULT_PORT)
		.option('--host <host>', 'Address to bind', '127.0.0.1')
		.option('--open', 'Open the preview in a browser')
		.option('--list', 'Print the compositions and what each is bound to, then exit')
		.option('--json', 'With --list, print JSON')
		.action(async (dir: string | undefined, options: DevOptions) => {
			const root = dir ?? process.cwd()

			try {
				// Before anything is read from disk: an unusable port is a mistake in
				// the invocation, and reporting it after a project scan would make a
				// typo look like a slow command.
				const port = options.list ? DEFAULT_PORT_NUMBER : portNumber(options.port)

				// Before the project is read, so a person missing the toolchain is
				// told all of it at once rather than one package per run. `--list`
				// needs only the package that owns the conventions, which
				// `loadDiscovery` asks for by itself.
				if (!options.list) assertDevPeers(root)

				const { discoverCompositions } = await loadDiscovery(root)
				const compositions = await discoverCompositions(root)

				if (options.list) {
					printList(compositions, Boolean(options.json))
					return
				}

				if (compositions.length === 0) {
					console.error(kleur.red(NOTHING_FOUND))
					process.exit(1)
				}

				const { startDevServer } = await import('./server.js')
				const server = await startDevServer({
					root,
					port,
					host: options.host,
					open: Boolean(options.open),
				})

				console.log()
				console.log(kleur.bold('  Paradoc compositions'), kleur.gray(server.url))
				console.log()
				for (const entry of compositions) {
					const mark = entry.problems.length > 0 ? kleur.red('!') : kleur.green('·')
					console.log(`  ${mark} ${describe(entry)}`)
					for (const problem of entry.problems) console.log(kleur.red(`      ${problem}`))
				}
				console.log()

				const stop = () => {
					void server.close().then(() => process.exit(0))
				}
				process.on('SIGINT', stop)
				process.on('SIGTERM', stop)
			} catch (error) {
				if (error instanceof MissingDevPeerError) {
					console.error(kleur.red(error.message))
					process.exit(1)
				}
				const message = error instanceof Error ? error.message : String(error)
				console.error(kleur.red(`Error: ${message}`))
				process.exit(1)
			}
		})

	return dev
}

/** The default, as a number, for the paths that never open a socket. */
const DEFAULT_PORT_NUMBER = Number(DEFAULT_PORT)

/** The port to listen on, or an error naming what was passed. */
function portNumber(value: string): number {
	const port = Number(value)
	if (!Number.isInteger(port) || port <= 0 || port > 65535) {
		console.error(kleur.red(`Error: --port must be a port number, not "${value}".`))
		process.exit(1)
	}
	return port
}

/** One line per composition: what it is, what renders it, where its data is. */
function describe(entry: DiscoveredComposition): string {
	return `${entry.relative} → ${bindingLabel(entry)} · ${sampleLabel(entry)}`
}

/**
 * What `--list` prints.
 *
 * An empty project is not a failure here: `--list` answers a question about the
 * project, and "nothing yet" is an answer. Starting the server on one is, which
 * is where that exits non-zero.
 */
function printList(compositions: readonly DiscoveredComposition[], asJson: boolean): void {
	if (asJson) {
		console.log(
			JSON.stringify(
				compositions.map((entry) => ({
					id: entry.id,
					composition: entry.relative,
					artifact: entry.artifact
						? {
								file: entry.artifact.relative,
								name: entry.artifact.name,
								layer: entry.artifact.layer ?? null,
								matched_by: entry.artifact.matchedBy,
							}
						: null,
					sample: {
						from: entry.samples[0]?.from ?? 'composition',
						file: entry.samples[0]?.relative ?? entry.relative,
					},
					problems: entry.problems,
				})),
				null,
				2,
			),
		)
		return
	}

	if (compositions.length === 0) {
		console.log(kleur.yellow(NOTHING_FOUND))
		return
	}

	for (const entry of compositions) {
		console.log(describe(entry))
		for (const problem of entry.problems) console.log(kleur.red(`  ${problem}`))
	}
}
