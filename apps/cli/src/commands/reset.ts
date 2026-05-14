import { Command } from 'commander'
import { homedir } from 'node:os'
import kleur from 'kleur'
import ora from 'ora'
import prompts from 'prompts'
import { LocalFileSystem } from '../utils/local-fs.js'

import type { GlobalConfig } from '../types.js'
import { registryClient } from '../utils/registry-client.js'
import { configManager } from '../utils/config.js'
import { rendererManager } from '../utils/renderer-manager.js'

/**
 * Global storage for ~/.paradoc operations
 */
const globalStorage = new LocalFileSystem(homedir())
const GLOBAL_DIR = '.paradoc'
const GLOBAL_CONFIG_PATH = globalStorage.joinPath(GLOBAL_DIR, 'config.json')
const GLOBAL_CACHE_DIR = globalStorage.joinPath(GLOBAL_DIR, 'cache')

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Get directory size recursively using storage
 */
async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0

  try {
    const entries = await globalStorage.listFiles(dirPath)

    for (const entryName of entries) {
      const entryPath = globalStorage.joinPath(dirPath, entryName)
      try {
        const stat = await globalStorage.stat(entryPath)
        if (stat.isDirectory) {
          totalSize += await getDirectorySize(entryPath)
        } else {
          totalSize += stat.size
        }
      } catch {
        // Ignore stat errors
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return totalSize
}

/**
 * Create the 'reset' command
 * Factory reset for Paradoc CLI
 */
export function createResetCommand(): Command {
  const reset = new Command('reset')

  reset
    .description('Reset Paradoc CLI to factory defaults (clears global config and cache)')
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('--keep-registries', 'Keep registry configurations')
    .option('--keep-cache', 'Keep cached data')
    .action(async (options: { yes?: boolean; keepRegistries?: boolean; keepCache?: boolean }) => {
      const spinner = ora()

      try {
        // Gather information about what will be deleted
        console.log()
        console.log(kleur.bold('Paradoc CLI Reset'))
        console.log()

        // Check what exists
        let configExists = false
        let cacheSize = 0

        configExists = await globalStorage.exists(GLOBAL_CONFIG_PATH)

        if (!options.keepCache) {
          cacheSize = await getDirectorySize(GLOBAL_CACHE_DIR)
        }

        // Show what will be affected
        console.log(kleur.gray('This will:'))
        console.log(kleur.cyan('  • Create fresh default config (~/.paradoc/config.json)'))

        if (!options.keepRegistries) {
          if (configExists) {
            console.log(kleur.yellow('    - Registry configurations will be removed'))
          }
        } else {
          console.log(kleur.gray('    - Registry configurations will be preserved'))
        }

        if (!options.keepCache) {
          if (cacheSize > 0) {
            console.log(kleur.yellow(`  • Clear cache (~/.paradoc/cache) - ${formatBytes(cacheSize)}`))
          } else {
            console.log(kleur.gray('  • Clear cache (currently empty)'))
          }
        } else {
          console.log(kleur.gray('  • Keep cached data'))
        }

        console.log()

        // Confirm unless --yes
        if (!options.yes) {
          const { confirmed } = await prompts({
            type: 'confirm',
            name: 'confirmed',
            message: 'Are you sure you want to reset?',
            initial: false,
          })

          if (!confirmed) {
            console.log(kleur.gray('Reset cancelled.'))
            return
          }
        }

        console.log()

        // Clear cache
        if (!options.keepCache) {
          spinner.start('Clearing cache...')
          await registryClient.initCache({ directory: GLOBAL_CACHE_DIR })
          const cacheResult = await registryClient.clearCache()
          if (cacheResult.deleted > 0) {
            spinner.succeed(`Cleared ${cacheResult.deleted} cached ${cacheResult.deleted === 1 ? 'entry' : 'entries'}`)
          } else {
            spinner.succeed('Cache cleared')
          }
        }

        // Clear installed renderers
        spinner.start('Clearing installed renderers...')
        await rendererManager.removeAll()
        spinner.succeed('Cleared installed renderers')

        // Preserve user preferences from existing config
        let existingRegistries: GlobalConfig['registries'] | undefined
        let existingTelemetryEnabled: boolean | undefined
        let existingAnonymousId: string | undefined
        if (configExists) {
          const config = await configManager.loadGlobalConfig()
          if (options.keepRegistries) {
            existingRegistries = config.registries
          }
          existingTelemetryEnabled = config.telemetry?.enabled
          existingAnonymousId = config.anonymousId
        }

        // Create fresh default config
        spinner.start('Creating default configuration...')

        // Default config with recommended settings
        const defaultConfig: GlobalConfig = {
          $schema: 'https://schema.paradoc.dev/config.json',
          registries: existingRegistries ?? {},
          defaults: {
            output: 'json' as const,
            artifactsDir: 'artifacts',
          },
          cache: {
            ttl: 3600, // 1 hour default
          },
          telemetry: {
            enabled: existingTelemetryEnabled ?? true,
          },
          // Preserve anonymous ID across resets
          ...(existingAnonymousId && { anonymousId: existingAnonymousId }),
        }

        await configManager.saveGlobalConfig(defaultConfig)
        spinner.succeed('Created default configuration')

        console.log()
        console.log(kleur.green('✓') + ' Paradoc CLI has been reset to factory defaults')
        console.log()
        console.log(kleur.gray('Default settings:'))
        console.log(kleur.gray('  Output format: json'))
        console.log(kleur.gray('  Artifacts directory: artifacts'))
        console.log(kleur.gray('  Cache TTL: 3600s (1 hour)'))
        console.log(kleur.gray('  Cache directory: ~/.paradoc/cache'))
        console.log(kleur.gray(`  Telemetry: ${defaultConfig.telemetry?.enabled !== false ? 'enabled' : 'disabled'}`))
        if (existingRegistries && Object.keys(existingRegistries).length > 0) {
          console.log(kleur.gray(`  Registries: ${Object.keys(existingRegistries).length} preserved`))
        } else {
          console.log()
          console.log(kleur.gray('Run `para registry add` to configure registries'))
        }
      } catch (error) {
        spinner.fail('Reset failed')
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  return reset
}
