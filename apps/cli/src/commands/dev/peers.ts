/**
 * The toolchain `para dev` borrows from the project.
 *
 * The preview compiles the project's own compositions against the project's own
 * React and its own `@paradoc/react`, so the bundler that compiles them is the
 * project's too. All seven are optional peers of `@paradoc/cli`, resolved at the
 * project, and a project missing one is told exactly what to install rather than
 * shown a resolution error from inside a dependency.
 *
 * **Why not the renderer manager.** `para` installs a renderer on first use
 * (`utils/renderer-manager.ts`), and `para check` installs `@paradoc/react` that
 * way, because a check needs one package and nothing else of the project. A
 * preview is the opposite case: it compiles the project's source, so the React
 * it renders with, the `@paradoc/react` the composition imports, and the Vite
 * that resolves both have to be the project's own, not a copy `para` fetched
 * into its cache. Installing them on demand would produce a second React beside
 * the project's and a preview of a document the project cannot build. A project
 * with compositions in it is a React project with a bundler; asking for that is
 * asking for what it already has.
 *
 * **Where each one is resolved.** `react`, `react-dom` and `@paradoc/react` are
 * resolved at the project and nowhere else: a copy of them from `para`'s own
 * installation would be a different React and a different component library from
 * the ones the page loads, which is the failure this is meant to prevent. The
 * bundler and its plugins have no such identity: they compile, they are not
 * compiled, so those fall back to `para`'s own dependencies, which is what makes
 * the command work inside this repository, where the packages are linked rather
 * than installed into a consumer project.
 */

import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { InlineConfig, Plugin, ViteDevServer } from 'vite'

/**
 * The packages whose identity has to be the project's, because the page loads
 * them. They are runtime dependencies of a project that composes documents.
 */
export const DEV_RUNTIME_PEERS = ['@paradoc/react', 'react', 'react-dom'] as const

/**
 * The packages that only compile. `para`'s own copies serve if the project has
 * none, so these are development dependencies.
 */
export const DEV_BUILD_PEERS = [
	'vite',
	'@vitejs/plugin-react',
	'@tailwindcss/vite',
	'tailwindcss',
] as const

/** Everything `para dev` needs from the project, named the way a person installs it. */
export const DEV_PEERS = [...DEV_BUILD_PEERS, ...DEV_RUNTIME_PEERS] as const

/** The install commands each package manager spells, by the lockfile it leaves. */
const PACKAGE_MANAGERS = [
	{ lockfile: 'pnpm-lock.yaml', runtime: 'pnpm add', development: 'pnpm add -D' },
	{ lockfile: 'yarn.lock', runtime: 'yarn add', development: 'yarn add -D' },
	{ lockfile: 'bun.lock', runtime: 'bun add', development: 'bun add -d' },
	{ lockfile: 'bun.lockb', runtime: 'bun add', development: 'bun add -d' },
	{ lockfile: 'package-lock.json', runtime: 'npm install', development: 'npm install --save-dev' },
] as const

/** The commands the project's own package manager would use. */
function installer(root: string): { runtime: string; development: string } {
	for (const manager of PACKAGE_MANAGERS) {
		if (existsSync(join(root, manager.lockfile))) return manager
	}
	return { runtime: 'npm install', development: 'npm install --save-dev' }
}

/** Thrown when the project cannot supply what the preview is built from. */
export class MissingDevPeerError extends Error {
	/** The packages that could not be resolved, in the order they are listed. */
	readonly peers: readonly string[]

	constructor(peers: readonly string[], root: string) {
		const commands = installer(root)
		const runtime = peers.filter((peer) => (DEV_RUNTIME_PEERS as readonly string[]).includes(peer))
		const development = peers.filter((peer) => !runtime.includes(peer))
		const lines = [
			runtime.length > 0 ? `  ${commands.runtime} ${runtime.join(' ')}` : undefined,
			development.length > 0 ? `  ${commands.development} ${development.join(' ')}` : undefined,
		].filter((line): line is string => line !== undefined)

		super(
			`para dev needs ${peers.join(', ')}, and ${peers.length === 1 ? 'it is' : 'they are'} not ` +
				`installed in ${root}. The preview compiles your compositions against your own React and ` +
				"your own @paradoc/react, so it uses your project's toolchain. Install them with:\n\n" +
				`${lines.join('\n')}\n`,
		)
		this.name = 'MissingDevPeerError'
		this.peers = peers
	}
}

/** Thrown when what `@paradoc/react` resolves to is not a package the preview can style. */
export class UnusableReactPackageError extends Error {
	constructor(directory: string, detail: string) {
		super(
			`The @paradoc/react installation at ${directory} cannot be used: ${detail} ` +
				"The preview compiles Tailwind against that directory's component sources, so without them " +
				'the components\' own classes are never generated and the document paginates shorter than it ' +
				'renders. Reinstall @paradoc/react in this project.',
		)
		this.name = 'UnusableReactPackageError'
	}
}

/** What the dev server needs, once every peer has been found. */
export interface DevToolchain {
	/** Vite's `createServer`, from the project's copy. */
	createServer: (config: InlineConfig) => Promise<ViteDevServer>
	/** The React plugin factory. */
	react: () => Plugin[] | Plugin
	/** The Tailwind plugin factory. */
	tailwindcss: () => Plugin[] | Plugin
	/** Directory `@paradoc/react` is installed in, for the stylesheet's sources. */
	reactPackageDir: string
}

/** Where a specifier may be resolved from, in the order the parents are tried. */
function parentsFor(root: string, specifier: string): string[] {
	const project = join(resolve(root), 'package.json')
	const owner = specifier.startsWith('@')
		? specifier.split('/').slice(0, 2).join('/')
		: (specifier.split('/')[0] ?? specifier)
	return (DEV_RUNTIME_PEERS as readonly string[]).includes(owner)
		? [project]
		: [project, import.meta.url]
}

/** The file a specifier resolves to, or nothing when the project has no such package. */
function resolveFrom(root: string, specifier: string): string | undefined {
	for (const parent of parentsFor(root, specifier)) {
		try {
			return createRequire(parent).resolve(specifier)
		} catch {
			// Try the next parent; a specifier missing from all of them is reported once, below.
		}
	}
	return undefined
}

/**
 * A module resolved for this project, imported through its file URL.
 *
 * @throws {MissingDevPeerError} when the project cannot supply it.
 */
export async function importPeer(root: string, specifier: string): Promise<Record<string, unknown>> {
	const file = resolveFrom(root, specifier)
	if (!file) throw new MissingDevPeerError([packageOf(specifier)], root)
	return (await import(pathToFileURL(file).href)) as Record<string, unknown>
}

/** The package a subpath specifier belongs to, which is what a person installs. */
function packageOf(specifier: string): string {
	const parts = specifier.split('/')
	return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? specifier)
}

/**
 * Every peer the project cannot supply, in the order they are listed.
 *
 * Separate from loading them so the command can ask before it reads the project:
 * a person with none of them installed should be told all seven at once, not
 * sent back for the next one each time they run it.
 */
export function missingDevPeers(root: string): string[] {
	return DEV_PEERS.filter((peer) => resolveFrom(root, entryOf(peer)) === undefined)
}

/** Refuses a project that cannot supply the toolchain. @throws {MissingDevPeerError} */
export function assertDevPeers(root: string): void {
	const missing = missingDevPeers(root)
	if (missing.length > 0) throw new MissingDevPeerError(missing, root)
}

/**
 * Everything the preview is built from, or one error naming every missing part.
 *
 * @throws {MissingDevPeerError} when the project cannot supply a peer.
 * @throws {UnusableReactPackageError} when `@paradoc/react` resolves to
 * something the stylesheet cannot be compiled against.
 */
export async function loadDevToolchain(root: string): Promise<DevToolchain> {
	assertDevPeers(root)

	const vite = await importPeer(root, 'vite')
	const reactPlugin = await importPeer(root, '@vitejs/plugin-react')
	const tailwindPlugin = await importPeer(root, '@tailwindcss/vite')

	return {
		createServer: vite.createServer as DevToolchain['createServer'],
		// Both plugins are default exports; a CommonJS build of either arrives
		// under `default` a second time, which is the one interop worth handling.
		react: unwrap(reactPlugin) as DevToolchain['react'],
		tailwindcss: unwrap(tailwindPlugin) as DevToolchain['tailwindcss'],
		reactPackageDir: paradocReactDir(root),
	}
}

/** The default export of a module, whichever way the module was built. */
function unwrap(module: Record<string, unknown>): unknown {
	const exported = module.default ?? module
	const nested = (exported as { default?: unknown }).default
	return typeof exported === 'function' ? exported : (nested ?? exported)
}

/**
 * The specifier used to test whether a package is installed.
 *
 * `@paradoc/react` publishes an export map without `./package.json`, so it is
 * probed through the one file every consumer already imports: its stylesheet.
 */
function entryOf(peer: string): string {
	return peer === '@paradoc/react' ? '@paradoc/react/styles.css' : peer
}

/**
 * The directory `@paradoc/react` is installed in.
 *
 * Derived from its stylesheet, which the export map places at `src/styles.css`
 * in both the published package and the workspace one. What it resolves to is
 * then checked rather than assumed — see {@link assertUsableReactPackage}.
 *
 * @throws {MissingDevPeerError} @throws {UnusableReactPackageError}
 */
export function paradocReactDir(root: string): string {
	const styles = resolveFrom(root, '@paradoc/react/styles.css')
	if (!styles) throw new MissingDevPeerError(['@paradoc/react'], root)
	const directory = resolve(dirname(styles), '..')
	assertUsableReactPackage(directory)
	return directory
}

/**
 * Refuses a directory that is not a usable `@paradoc/react` installation.
 *
 * Tailwind compiles the preview's stylesheet against this directory's component
 * sources. A directory that is not the package, or one with neither `dist` nor
 * `src` in it, would compile a stylesheet missing every class the components
 * carry: the document would still render, and would paginate shorter than it
 * renders, and nothing on the page would say so. That failure is invisible, so
 * it is refused here instead.
 *
 * @throws {UnusableReactPackageError}
 */
export function assertUsableReactPackage(directory: string): void {
	const manifest = join(directory, 'package.json')
	if (!existsSync(manifest)) {
		throw new UnusableReactPackageError(directory, 'it holds no package.json.')
	}
	let name: unknown
	try {
		name = (JSON.parse(readFileSync(manifest, 'utf8')) as { name?: unknown }).name
	} catch (error) {
		throw new UnusableReactPackageError(
			directory,
			`its package.json could not be read: ${error instanceof Error ? error.message : String(error)}.`,
		)
	}
	if (name !== '@paradoc/react') {
		throw new UnusableReactPackageError(directory, `its package.json names ${String(name)}.`)
	}
	if (!existsSync(join(directory, 'dist')) && !existsSync(join(directory, 'src'))) {
		throw new UnusableReactPackageError(directory, 'it holds neither a dist nor a src directory.')
	}
}
