import type { Command } from 'commander'

export interface CommandEntry {
	name: string
	description: string
	group: 'Registry' | 'Artifacts' | 'Project' | 'Settings'
	aliases?: string[]
	load: () => Promise<Command>
}

export const commandEntries: CommandEntry[] = [
	// Registry
	{ name: 'add', description: 'Add an artifact from a registry or direct URL', group: 'Registry',
		load: () => import('./commands/add.js').then(m => m.createAddCommand()) },
	{ name: 'list', description: 'List installed artifacts', group: 'Registry', aliases: ['ls'],
		load: () => import('./commands/list.js').then(m => m.createListCommand()) },
	{ name: 'search', description: 'Search for artifacts in a registry', group: 'Registry',
		load: () => import('./commands/search.js').then(m => m.createSearchCommand()) },
	{ name: 'registry', description: 'Manage registry configurations', group: 'Registry',
		load: () => import('./commands/registry.js').then(m => m.createRegistryCommand()) },

	// Artifacts
	{ name: 'show', description: 'Show details about an artifact', group: 'Artifacts',
		load: () => import('./commands/show.js').then(m => m.createShowCommand()) },
	{ name: 'validate', description: 'Validate any Paradoc artifact against the core schema', group: 'Artifacts',
		load: () => import('./commands/validate.js').then(m => m.createValidateCommand()) },
	{ name: 'inspect', description: 'Inspect PDF form fields to aid in bindings configuration', group: 'Artifacts',
		load: () => import('./commands/inspect.js').then(m => m.createInspectCommand()) },
	{ name: 'render', description: 'Render an artifact layer', group: 'Artifacts',
		load: () => import('./commands/render.js').then(m => m.createRenderCommand()) },
	{ name: 'new', description: 'Create new Paradoc artifacts', group: 'Artifacts',
		load: () => import('./commands/new/index.js').then(m => m.createNewCommand()) },
	{ name: 'fix', description: 'Fix artifact metadata (e.g., file checksums in layers)', group: 'Artifacts',
		load: () => import('./commands/fix.js').then(m => m.createFixCommand()) },
	{ name: 'version', description: 'Bump semantic version in an artifact file', group: 'Artifacts',
		load: () => import('./commands/version.js').then(m => m.createVersionCommand()) },
	{ name: 'attach', description: 'Attach a file as a layer to an artifact', group: 'Artifacts',
		load: () => import('./commands/attach.js').then(m => m.createAttachCommand()) },
	{ name: 'detach', description: 'Detach (remove) a layer from an artifact', group: 'Artifacts',
		load: () => import('./commands/detach.js').then(m => m.createDetachCommand()) },
	{ name: 'generate', description: 'Generate TypeScript types for an artifact file', group: 'Artifacts',
		load: () => import('./commands/generate.js').then(m => m.createGenerateCommand()) },
	{ name: 'hash', description: 'Compute SHA256 checksum of a file (for use in layer definitions)', group: 'Artifacts',
		load: () => import('./commands/hash.js').then(m => m.createHashCommand()) },
	{ name: 'data', description: 'Data operations for Paradoc artifacts', group: 'Artifacts',
		load: () => import('./commands/data/index.js').then(m => m.createDataCommand()) },
	{ name: 'diff', description: 'Show differences between two artifact files', group: 'Artifacts',
		load: () => import('./commands/diff.js').then(m => m.createDiffCommand()) },

	// Project
	{ name: 'init', description: 'Initialize a new Paradoc project', group: 'Project',
		load: () => import('./commands/init.js').then(m => m.createInitCommand()) },
	{ name: 'apply', description: 'Apply a unified diff patch to the working directory', group: 'Project',
		load: () => import('./commands/apply.js').then(m => m.createApplyCommand()) },

	// Settings
	{ name: 'configure', description: 'Interactive configuration wizard for Paradoc CLI', group: 'Settings', aliases: ['config'],
		load: () => import('./commands/configure.js').then(m => m.createConfigureCommand()) },
	{ name: 'cache', description: 'Manage registry cache', group: 'Settings',
		load: () => import('./commands/cache.js').then(m => m.createCacheCommand()) },
	{ name: 'renderers', description: 'Manage renderer plugins (installed on first use)', group: 'Settings',
		load: () => import('./commands/renderers.js').then(m => m.createRenderersCommand()) },
	{ name: 'reset', description: 'Reset Paradoc CLI to factory defaults (clears global config and cache)', group: 'Settings',
		load: () => import('./commands/reset.js').then(m => m.createResetCommand()) },
	{ name: 'docs', description: 'Open Paradoc documentation in browser', group: 'Settings',
		load: () => import('./commands/docs.js').then(m => m.createDocsCommand()) },
	{ name: 'console', description: 'Open Paradoc web console in browser', group: 'Settings',
		load: () => import('./commands/console.js').then(m => m.createConsoleCommand()) },
	{ name: 'about', description: 'Display information about Paradoc Manager', group: 'Settings',
		load: () => import('./commands/about.js').then(m => m.createAboutCommand()) },
]
