import { Command } from 'commander'
import kleur from 'kleur'
import ora from 'ora'

import { rendererManager } from '../utils/renderer-manager.js'
import { formatTable } from '../utils/table.js'
import { formatBytes } from '../utils/format.js'

export function createRenderersCommand(): Command {
  const renderers = new Command('renderers')
  renderers.description('Manage renderer plugins (installed on first use)')

  // renderers status
  renderers
    .command('status')
    .description('Show installation status of all renderers')
    .option('--json', 'Output as JSON')
    .action(async (options: { json?: boolean }) => {
      try {
        const statuses = await rendererManager.status()

        if (options.json) {
          console.log(JSON.stringify(statuses, null, 2))
          return
        }

        console.log()
        console.log(kleur.bold('Renderer plugins'))
        console.log()

        const rows = statuses.map((s) => [
          s.name,
          s.installed ? kleur.green(s.installedVersion!) : kleur.gray('not installed'),
          s.expectedVersion,
          s.installed && s.installedVersion !== s.expectedVersion
            ? kleur.yellow('update available')
            : s.installed
              ? kleur.green('ok')
              : kleur.gray('-'),
          s.size !== null ? formatBytes(s.size) : kleur.gray('-'),
        ])

        console.log(formatTable(
          ['Package', 'Installed', 'Expected', 'Status', 'Size'],
          rows,
        ))
        console.log()
      } catch (error) {
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  // renderers install [name]
  renderers
    .command('install [name]')
    .description('Install a renderer (or all if no name given)')
    .action(async (name?: string) => {
      try {
        if (name) {
          const packages = rendererManager.getRendererPackages()
          const pkg = resolveRendererName(name, packages)
          await rendererManager.installRenderer(pkg)
        } else {
          await rendererManager.installAll()
        }
      } catch (error) {
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  // renderers remove [name]
  renderers
    .command('remove [name]')
    .description('Remove a renderer (or all if no name given)')
    .action(async (name?: string) => {
      const spinner = ora()

      try {
        if (name) {
          const packages = rendererManager.getRendererPackages()
          const pkg = resolveRendererName(name, packages)
          spinner.start(`Removing ${pkg}...`)
          await rendererManager.removeRenderer(pkg)
          spinner.succeed(`Removed ${pkg}`)
        } else {
          spinner.start('Removing all renderers...')
          await rendererManager.removeAll()
          spinner.succeed('Removed all renderers')
        }
      } catch (error) {
        spinner.fail('Failed to remove renderer')
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  // renderers update
  renderers
    .command('update')
    .description('Update installed renderers to match current CLI version')
    .action(async () => {
      try {
        const installed = (await rendererManager.status()).filter((renderer) => renderer.installed)
        for (const renderer of installed) await rendererManager.installRenderer(renderer.name)

        console.log()
        console.log(kleur.green('✓') + ` Updated ${installed.length} installed ${installed.length === 1 ? 'renderer' : 'renderers'}`)
      } catch (error) {
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  return renderers
}

/**
 * Resolve a renderer name to its package. Accepts the full package name, its
 * short name, or one of its subpaths (`@paradoc/react-pdf/check`).
 */
export function resolveRendererName(name: string, packages: Record<string, string>): string {
  const match = Object.keys(packages).find(
    (pkg) => name === pkg || name.startsWith(`${pkg}/`) || name === pkg.split('/').pop(),
  )
  if (match) return match

  const available = Object.keys(packages).map((pkg) => pkg.split('/').pop()).join(', ')
  throw new Error(`Unknown renderer "${name}". Available: ${available}`)
}
