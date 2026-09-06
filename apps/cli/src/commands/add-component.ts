/**
 * `para add <name>` — install a document component from the Paradoc registry.
 *
 * The components are shadcn registry items, so the install itself is the stock
 * shadcn CLI's job and this does not reimplement it. What it does is the part a
 * consumer would otherwise do by hand: put the `@paradoc` namespace into the
 * project's `components.json`, so `@paradoc/field` resolves to
 * `https://docs.paradoc.dev/r/field.json`, and then run the install.
 *
 * `para add @namespace/name` still adds an artifact from an artifact registry.
 * The two are told apart by shape: an artifact is always namespaced or a URL, a
 * component is always a bare name.
 */

import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import kleur from 'kleur'

/**
 * The namespace the components are published under, and where they are served.
 *
 * Both are declared by the registry itself, in
 * `paradoc/packages/react/scripts/registry/manifest.ts`, which is what the
 * generator writes into `components.json`-shaped instructions in the docs. They
 * are repeated here because the CLI ships on its own and cannot import a build
 * script from another package; `tests/commands/add-component.test.ts` reads the
 * served index and fails if the two drift.
 */
export const COMPONENT_NAMESPACE = '@paradoc'

/** Where the docs site serves the registry. `{name}` is the item. */
export const COMPONENT_REGISTRY_URL = 'https://docs.paradoc.dev/r/{name}.json'

/**
 * The shadcn CLI major this command runs.
 *
 * Pinned, not `@latest`: the registry's install-and-typecheck proof runs this
 * major, and the CLI's file placement and import rewriting are exactly the
 * behaviour that proof covers. A new major moves that ground.
 */
export const SHADCN_SPEC = 'shadcn@4'

/**
 * The items the registry ships.
 *
 * Named here so a bare argument that is not one of them falls through to the
 * artifact path and gets an error naming both forms, rather than being sent to
 * the shadcn CLI to fail on a 404.
 */
export const COMPONENT_ITEMS = [
  'bundle',
  'document',
  'field',
  'keep-together',
  'pages',
  'paper',
  'part',
  'pdf-pages',
  'section',
  'signature',
  'table',
  'totals',
] as const

/**
 * True when this argument names a component this registry ships.
 *
 * An artifact reference carries a namespace (`@acme/w9`) or is a URL, so it can
 * never be one; a bare name that is not a known item is not one either, and is
 * left to the artifact path to reject.
 */
export function isComponentName(arg: string): boolean {
  return (COMPONENT_ITEMS as readonly string[]).includes(arg)
}

/** What `ensureNamespace` did, so the caller can say it out loud. */
export type NamespaceResult = 'added' | 'present' | 'conflict'

interface ComponentsConfig {
  registries?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * Finds the `components.json` that governs this directory.
 *
 * shadcn's config sits at the front-end project's root, which is not always the
 * Paradoc project root: a monorepo keeps artifacts at the top and the app in a
 * package. So the search walks up from where the command was run.
 */
export async function findComponentsConfig(from: string): Promise<string | null> {
  let directory = from
  for (;;) {
    const candidate = join(directory, 'components.json')
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      const parent = dirname(directory)
      if (parent === directory) return null
      directory = parent
    }
  }
}

/**
 * Writes the `@paradoc` namespace into `components.json` if it is not there.
 *
 * A namespace already pointing somewhere else is left alone and reported: a
 * project pointing at its own mirror of the registry means it, and silently
 * repointing it at ours would install different files than the ones it expects.
 */
export async function ensureNamespace(
  configPath: string,
  registryUrl: string = COMPONENT_REGISTRY_URL,
): Promise<NamespaceResult> {
  const raw = await fs.readFile(configPath, 'utf8')
  const config = JSON.parse(raw) as ComponentsConfig
  const existing = config.registries?.[COMPONENT_NAMESPACE]

  if (existing !== undefined) {
    return existing === registryUrl ? 'present' : 'conflict'
  }

  config.registries = { ...config.registries, [COMPONENT_NAMESPACE]: registryUrl }

  // Two spaces and a trailing newline: what every tool that writes this file
  // uses, so adding one key does not reformat the whole thing in the diff.
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  return 'added'
}

/** Runs a command in the project and resolves with its exit code. */
function run(command: string, args: string[], cwd: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit', shell: false })
    child.on('error', reject)
    child.on('close', (code) => resolve(code ?? 1))
  })
}

export interface AddComponentOptions {
  /** Project directory. Defaults to where the command was run. */
  cwd?: string
  /** Registry URL template, for a mirror or a local registry under test. */
  registry?: string
  /** Prints the install command instead of running it. */
  dryRun?: boolean
}

/**
 * Installs one or more components, ensuring the namespace first.
 *
 * Returns the process exit code so the caller decides how to end.
 */
export async function addComponents(
  names: string[],
  options: AddComponentOptions = {},
): Promise<number> {
  const cwd = options.cwd ?? process.cwd()
  const registryUrl = options.registry ?? COMPONENT_REGISTRY_URL

  // The shadcn CLI substitutes the item name into the template, so a URL
  // without the placeholder would resolve every item to the same file.
  if (!registryUrl.includes('{name}')) {
    console.error(kleur.red(`Registry URL must contain {name}: ${registryUrl}`))
    return 1
  }

  const configPath = await findComponentsConfig(cwd)
  if (!configPath) {
    console.error(kleur.red('No components.json found.'))
    console.error(
      kleur.gray(
        'The document components install through the shadcn CLI. Run `npx shadcn@latest init` first.',
      ),
    )
    return 1
  }

  const namespace = await ensureNamespace(configPath, registryUrl)
  if (namespace === 'conflict') {
    console.error(
      kleur.red(`components.json already maps ${COMPONENT_NAMESPACE} to a different registry.`),
    )
    console.error(
      kleur.gray(`Point it at ${registryUrl}, or install with the full URL instead.`),
    )
    return 1
  }
  if (namespace === 'added') {
    console.log(kleur.gray(`Registered ${COMPONENT_NAMESPACE} in ${configPath}`))
  }

  const items = names.map((name) => `${COMPONENT_NAMESPACE}/${name}`)
  const args = [SHADCN_SPEC, 'add', ...items, '--yes']

  if (options.dryRun) {
    console.log(`npx ${args.join(' ')}`)
    return 0
  }

  return run('npx', args, dirname(configPath))
}
