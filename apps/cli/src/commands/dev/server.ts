/**
 * The dev server behind `paradoc dev`.
 *
 * One Vite server rooted at the project. Vite compiles the compositions for the
 * browser, which draws the paginated document, and it compiles the same modules
 * for Node through `ssrLoadModule`, which is where the PDF is rendered: the
 * engine reads font files and drives WebAssembly, so it cannot run in the page.
 * That is the lab's arrangement, generalized from one document to every
 * composition the project holds.
 *
 * The PDF route checks before it renders. `@paradoc/react/check` walks the tree
 * the way the PDF path does and names the classes the engine cannot express and
 * the paths the artifact does not declare; those come back as findings the page
 * shows where the PDF would have been. Only a tree with no findings is rendered.
 *
 * Images are resolved between the two. A composition names an image the way any
 * Vite module does, and the URL that produces means nothing to an engine in
 * Node, so every `src` the check reports as unresolved is looked up under the
 * project root and its bytes are handed to the render. One that does not resolve
 * is left alone: `renderPdf` names it, which is the answer the developer needs.
 */

import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'

import type { Plugin, ViteDevServer } from 'vite'

import { loadDiscovery, type DiscoveredComposition } from './discovery.js'
import {
	clientModule,
	elementModule,
	HARNESS_MODULES,
	indexHtml,
	manifestModule,
	PDF_ROUTE,
	stylesheetModule,
} from './harness.js'
import { messagesFor } from './messages.js'
import { loadDevToolchain } from './peers.js'

/** What the browser asks the PDF route for. */
interface PdfRequest {
	id?: string
	plan?: { breaks: string[]; repeats: string[][] }
}

/** How `paradoc dev` was invoked. */
export interface DevServerOptions {
	/** Project root: what is discovered, and what Vite serves. */
	root: string
	port: number
	host: string
	/** Open the preview in a browser once it is listening. */
	open: boolean
}

/** A running preview. */
export interface DevServer {
	url: string
	/** What was discovered when the server started. */
	compositions: readonly DiscoveredComposition[]
	close: () => Promise<void>
}

/**
 * Starts the preview.
 *
 * @throws {MissingDevPeerError} when the project cannot supply the toolchain.
 */
export async function startDevServer(options: DevServerOptions): Promise<DevServer> {
	const root = resolve(options.root)
	const toolchain = await loadDevToolchain(root)
	const discovery = await loadDiscovery(root)
	// Discovery runs once here and again when a file it read changes. Between a
	// change and the re-read the manifest is one revision behind, which the
	// watcher below closes; nothing else keeps it current.
	let compositions = await discovery.discoverCompositions(root)

	const server = await toolchain.createServer({
		root,
		// The project's own Vite config is not read. `paradoc dev` serves one page it
		// generates itself, and a config written for the project's application
		// would apply its plugins, aliases and entry points to a page that is not
		// the application. A composition imports packages and its own neighbours;
		// nothing else is promised.
		configFile: false,
		envFile: false,
		appType: 'custom',
		clearScreen: false,
		logLevel: 'warn',
		server: {
			port: options.port,
			host: options.host,
			strictPort: true,
			open: options.open,
			// The document's typeface travels with `@paradoc/react`, which a
			// workspace links from outside the project. Vite serves nothing outside
			// the root by default, so the package and the packages it installed are
			// named exactly, or the preview loads a page with no font and paginates
			// against the wrong metrics.
			fs: { allow: servableRoots(root) },
		},
		plugins: [
			toolchain.react(),
			toolchain.tailwindcss(),
			harnessPlugin(root, () => compositions, discovery.IGNORED_DIRECTORIES),
		],
	})

	// Discovery read the artifacts and looked for the compositions and samples
	// beside them, so a change to any of those three can change the answer: a new
	// composition, a renamed sample, a layer pointed somewhere else. Editing a
	// composition's contents is Vite's business and never reaches here; adding or
	// removing one is this. The manifest module is invalidated and the page
	// reloaded rather than patched, because a different pairing can change which
	// compositions exist at all.
	const rediscover = rediscoverer(
		() => discovery.discoverCompositions(root),
		root,
		server,
		(found) => {
			compositions = found
		},
	)
	server.watcher.on('add', (file) => rediscover(file, 'add'))
	server.watcher.on('unlink', (file) => rediscover(file, 'unlink'))
	server.watcher.on('change', (file) => rediscover(file, 'change'))

	server.middlewares.use(PDF_ROUTE, (request, response) => {
		void renderRoute(server, root, () => compositions, request, response)
	})
	server.middlewares.use((request, response, next) => {
		void servePage(server, request, response, next)
	})

	await server.listen()

	return {
		url: `http://${options.host}:${options.port}`,
		get compositions() {
			return compositions
		},
		close: () => server.close(),
	}
}

/**
 * Directories the dev server may read files from.
 *
 * The project, the `@paradoc/react` installation, and the packages that
 * installation depends on, which is where its typeface files are. Nothing else:
 * an earlier version walked to the filesystem root allowing every ancestor that
 * held a `node_modules`, which put the whole checkout — and, with a stray
 * `~/node_modules`, the home directory — behind a local HTTP server.
 *
 * A dependency is named through the installation's own `node_modules`, and its
 * real path is what is allowed, because a package manager that links rather than
 * copies puts the files somewhere else entirely and Vite checks the path it
 * finally reads.
 */
export function servableRoots(root: string): string[] {
	return [resolve(root)]
}

/**
 * Re-runs discovery when a file discovery read has appeared or gone.
 *
 * Debounced, because saving a composition and its sample together is two events
 * and one answer, and coalesced, because a scan started for the first event
 * would otherwise be racing the one started for the second and the later result
 * is not guaranteed to be the later scan.
 */
function rediscoverer(
	discover: () => Promise<DiscoveredComposition[]>,
	root: string,
	server: ViteDevServer,
	apply: (found: DiscoveredComposition[]) => void,
): (file: string, event: 'add' | 'unlink' | 'change') => void {
	let timer: NodeJS.Timeout | undefined
	let running = false
	let again = false

	const run = async (): Promise<void> => {
		if (running) {
			again = true
			return
		}
		running = true
		try {
			do {
				again = false
				apply(await discover())
			} while (again)
			invalidate(server, resolve(root, HARNESS_MODULES.manifest.slice(1)))
			reload(server)
		} finally {
			running = false
		}
	}

	return (file, event) => {
		// An artifact's contents decide the pairing, so any change to one counts.
		// A composition or a sample only changes the answer by existing or not;
		// its contents are Vite's to reload.
		const counts = ARTIFACT_FILE.test(file)
			? true
			: event !== 'change' && MODULE_FILE.test(file)
		if (!counts) return
		if (timer) clearTimeout(timer)
		timer = setTimeout(() => void run(), REDISCOVER_DEBOUNCE_MS)
	}
}

/** Long enough to swallow one editor's save burst, short enough not to be felt. */
const REDISCOVER_DEBOUNCE_MS = 100

/** Files discovery parses as artifacts. */
const ARTIFACT_FILE = /\.(ya?ml|json)$/i

/** Files discovery counts as a composition or a sample. */
const MODULE_FILE = /\.[jt]sx?$/i

/** Serves the generated modules, and the page for everything else. */
function harnessPlugin(
	root: string,
	current: () => readonly DiscoveredComposition[],
	ignored: readonly string[],
): Plugin {
	const paths = {
		client: resolve(root, HARNESS_MODULES.client.slice(1)),
		manifest: resolve(root, HARNESS_MODULES.manifest.slice(1)),
		styles: resolve(root, HARNESS_MODULES.styles.slice(1)),
		element: resolve(root, HARNESS_MODULES.element.slice(1)),
	}

	return {
		name: 'paradoc:dev-harness',
		// Ahead of Vite's own resolution, which would look for these on disk.
		enforce: 'pre',

		resolveId(source) {
			const id = source.startsWith('/') ? resolve(root, source.slice(1)) : source
			return Object.values(paths).includes(id) ? id : undefined
		},

		load(id) {
			if (id === paths.client) return clientModule()
			if (id === paths.manifest) return manifestModule(current())
			if (id === paths.styles) return stylesheetModule(root, ignored)
			if (id === paths.element) return elementModule()
			return undefined
		},
	}
}

/** Tells the page to reload, through whichever channel this Vite exposes. */
function reload(server: ViteDevServer): void {
	const channel = (server as { hot?: { send: (payload: unknown) => void } }).hot ?? server.ws
	channel.send({ type: 'full-reload' })
}

/** Drops a module from the graph so the next request rebuilds it. */
function invalidate(server: ViteDevServer, id: string): void {
	const module = server.moduleGraph.getModuleById(id)
	if (module) server.moduleGraph.invalidateModule(module)
}

/** The preview page, for every route the PDF endpoint did not take. */
async function servePage(
	server: ViteDevServer,
	request: IncomingMessage,
	response: ServerResponse,
	next: (error?: unknown) => void,
): Promise<void> {
	const url = request.url ?? '/'
	// Anything with an extension is a module or an asset Vite already handled.
	if (request.method !== 'GET' || /\.[a-z0-9]+(\?|$)/i.test(url)) return next()

	try {
		const html = await server.transformIndexHtml(url, indexHtml())
		response.setHeader('Content-Type', 'text/html; charset=utf-8')
		response.setHeader('Cache-Control', 'no-store')
		response.end(html)
	} catch (error) {
		next(error)
	}
}

/** Reads the request body a POST carries. */
async function readRequest(request: IncomingMessage): Promise<PdfRequest> {
	if (request.method !== 'POST') return {}
	const chunks: Buffer[] = []
	for await (const chunk of request) chunks.push(chunk as Buffer)
	const body = Buffer.concat(chunks).toString('utf8')
	return body.length === 0 ? {} : (JSON.parse(body) as PdfRequest)
}

/** Checks one composition and renders its PDF, or reports what stopped it. */
async function renderRoute(
	server: ViteDevServer,
	root: string,
	current: () => readonly DiscoveredComposition[],
	request: IncomingMessage,
	response: ServerResponse,
): Promise<void> {
	try {
		const sent = await readRequest(request)
		const entry = current().find((each) => each.id === sent.id)
		if (!entry) {
			return findings(response, [
				{ kind: 'composition-error', message: `No composition with id "${String(sent.id)}".` },
			])
		}
		if (!entry.artifact || entry.problems.length > 0) {
			return findings(
				response,
				entry.problems.map((message) => ({ kind: 'composition-error', message })),
			)
		}

		const messages = messagesFor(entry)
		const module = (await server.ssrLoadModule(entry.file)) as Record<string, unknown>
		const Composition = module.default
		if (typeof Composition !== 'function') {
			return findings(response, [{ kind: 'composition-error', message: messages.noComponent }])
		}

		const sample = entry.samples[0]
		const sampleModule =
			sample && sample.from === 'sibling'
				? ((await server.ssrLoadModule(sample.file)) as Record<string, unknown>)
				: module
		const data = readSample(entry, sampleModule)

		// React comes from the project through Vite, not from `paradoc`: the element
		// has to be made by the same React the composition imports, which is what
		// the generated element module guarantees.
		const { element: makeElement } = (await server.ssrLoadModule(HARNESS_MODULES.element)) as {
			element: (type: unknown, props: unknown) => unknown
		}
		const element = makeElement(Composition, { artifact: entry.artifact.artifact, data })
		// The same walk `paradoc check` runs, over the element the project's own
		// React built. `missingImages` is not a verdict here: this command
		// resolves image bytes itself, just below, so a composition that names an
		// image the tool can supply is not broken for needing it.
		const { checkElement } = (await server.ssrLoadModule('@paradoc/react/check')) as {
			checkElement: (element: unknown, options?: unknown) => Promise<CheckResult>
		}
		const check = await checkElement(element)
		const faults = [
			...check.unsupportedClasses.map((className) => ({
				kind: 'unsupported-class',
				message: `The PDF renderer does not support the class "${className}".`,
			})),
			// Worded as `UnknownFieldPathError` words it, because the browser draws
			// the same fault from that error a moment earlier and one document
			// should not be described two ways in two panes.
			...check.unresolvedPaths.map((path) => ({
				kind: 'unresolved-path',
				message: `The form "${entry.artifact?.name ?? ''}" declares no field at path "${path}".`,
			})),
		]
		if (faults.length > 0) return findings(response, faults)

		const { renderPdf } = (await server.ssrLoadModule('@paradoc/react/pdf')) as {
			renderPdf: (element: unknown, options?: unknown) => Promise<RenderResult>
		}
		const result = await renderPdf(element, {
			images: await loadImages(root, check.missingImages),
			plan: sent.plan,
		})

		response.setHeader('Content-Type', 'application/pdf')
		response.setHeader('Cache-Control', 'no-store')
		if (result.unknownBreaks.length > 0) {
			response.setHeader('X-Paradoc-Unknown-Breaks', result.unknownBreaks.join(','))
		}
		if (result.unknownRepeats.length > 0) {
			response.setHeader('X-Paradoc-Unknown-Repeats', result.unknownRepeats.join(','))
		}
		response.end(Buffer.from(result.bytes))
	} catch (error) {
		response.statusCode = 500
		response.setHeader('Content-Type', 'text/plain; charset=utf-8')
		response.end(error instanceof Error ? error.message : String(error))
	}
}

/** What `@paradoc/react/check` answers with. */
interface CheckResult {
	unsupportedClasses: string[]
	unresolvedPaths: string[]
	missingImages: string[]
}

/** What `renderPdf` answers with. */
interface RenderResult {
	bytes: Uint8Array
	unknownBreaks: string[]
	unknownRepeats: string[]
}

/** Sends findings the page shows in place of the document. */
function findings(response: ServerResponse, list: { kind: string; message: string }[]): void {
	response.statusCode = 422
	response.setHeader('Content-Type', 'application/json; charset=utf-8')
	response.setHeader('Cache-Control', 'no-store')
	response.end(JSON.stringify({ findings: list }))
}

/** The sample data one composition previews with. */
function readSample(
	entry: DiscoveredComposition,
	module: Record<string, unknown>,
): { fields: Record<string, unknown>; parties: Record<string, unknown> } {
	const messages = messagesFor(entry)
	const from = entry.samples[0]?.from ?? 'composition'
	const value = (from === 'sibling' ? (module.default ?? module.sample) : module.sample) as
		| { fields?: unknown; parties?: unknown }
		| undefined
	if (value === undefined || value === null) throw new Error(messages.noSample)
	if (typeof value.fields !== 'object' || value.fields === null) throw new Error(messages.badSample)
	return {
		fields: value.fields as Record<string, unknown>,
		parties: (value.parties ?? {}) as Record<string, unknown>,
	}
}

/**
 * Bytes for the images a composition names.
 *
 * A Vite module names an image by the URL Vite serves it at, which is
 * root-relative, or by `/@fs/` and an absolute path when the file is outside the
 * root. Both are turned back into a file. A `src` that is neither is skipped and
 * the render names it.
 */
async function loadImages(
	root: string,
	sources: readonly string[],
): Promise<{ src: string; data: Uint8Array }[]> {
	const images: { src: string; data: Uint8Array }[] = []
	for (const src of sources) {
		const path = fileFor(root, src)
		if (!path) continue
		try {
			images.push({ src, data: new Uint8Array(await readFile(path)) })
		} catch {
			// Not a file on disk. `renderPdf` names it, which says more than a guess here would.
		}
	}
	return images
}

/** The file a Vite asset URL points at, when it points at one. */
function fileFor(root: string, src: string): string | undefined {
	if (/^[a-z]+:/i.test(src)) return undefined
	const path = src.split('?')[0] ?? ''
	if (path.startsWith('/@fs/')) return path.slice('/@fs'.length)
	if (path.startsWith('/')) return resolve(root, path.slice(1))
	return undefined
}
