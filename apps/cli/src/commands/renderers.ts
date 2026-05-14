import { Command } from 'commander'
import kleur from 'kleur'
import ora from 'ora'

import { rendererManager } from '../utils/renderer-manager.js'
import { formatTable } from '../utils/table.js'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

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
          // Allow short names like "text", "pdf", "docx"
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
    .description('Reinstall all renderers to match current CLI version')
    .action(async () => {
      try {
        const spinner = ora('Removing outdated renderers...').start()
        await rendererManager.removeAll()
        spinner.succeed('Cleared existing renderers')

        await rendererManager.installAll()

        console.log()
        console.log(kleur.green('✓') + ' All renderers updated')
      } catch (error) {
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  return renderers
}

/** Resolve short renderer names (text, pdf, docx) to full package names */
function resolveRendererName(name: string, packages: Record<string, string>): string {
  // If it's already a full package name, validate it
  if (name in packages) return name

  // Try short name: "text" -> "@paradoc/renderer-text"
  const fullName = `@paradoc/renderer-${name}`
  if (fullName in packages) return fullName

  const available = Object.keys(packages).map(p => p.split('/').pop()).join(', ')
  throw new Error(`Unknown renderer "${name}". Available: ${available}`)
}
