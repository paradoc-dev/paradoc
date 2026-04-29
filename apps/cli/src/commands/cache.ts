import { Command } from 'commander'
import kleur from 'kleur'
import ora from 'ora'

import { registryClient } from '../utils/registry-client.js'
import { configManager } from '../utils/config.js'
import { findRepoRoot } from '../utils/project.js'
import { resolveRegistry } from '../utils/registry.js'

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Format TTL to human-readable string
 */
function formatTtl(seconds: number): string {
  if (seconds === 0) return 'disabled'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

/**
 * Create the 'cache' command group
 * Manages registry cache
 */
export function createCacheCommand(): Command {
  const cache = new Command('cache')
  cache.description('Manage registry cache')

  // cache clear
  cache
    .command('clear')
    .description('Clear all cached registry data')
    .action(async () => {
      const spinner = ora()

      try {
        // Initialize cache
        const projectRoot = await findRepoRoot()
        if (projectRoot) {
          await configManager.loadProjectManifest(projectRoot)
        }
        const cacheDir = await configManager.getCacheDirectory()
        await registryClient.initCache({ directory: cacheDir })

        spinner.start('Clearing cache...')
        const result = await registryClient.clearCache()
        spinner.stop()

        if (result.deleted === 0) {
          console.log(kleur.gray('Cache is already empty.'))
        } else {
          console.log(kleur.green('✓') + ` Cleared ${result.deleted} cached ${result.deleted === 1 ? 'entry' : 'entries'}`)
        }

        if (result.errors > 0) {
          console.log(kleur.yellow(`Warning: ${result.errors} ${result.errors === 1 ? 'entry' : 'entries'} could not be deleted`))
        }
      } catch (error) {
        spinner.fail('Failed to clear cache')
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  // cache stats
  cache
    .command('stats')
    .alias('info')
    .option('--json', 'Output as JSON')
    .description('Show cache statistics')
    .action(async (options: { json?: boolean }) => {
      try {
        // Initialize cache
        const projectRoot = await findRepoRoot()
        if (projectRoot) {
          await configManager.loadProjectManifest(projectRoot)
        }
        const cacheDir = await configManager.getCacheDirectory()
        await registryClient.initCache({ directory: cacheDir })

        const stats = await registryClient.getCacheStats()

        if (options.json) {
          console.log(JSON.stringify(stats, null, 2))
        } else {
          console.log()
          console.log(kleur.bold('Cache Statistics'))
          console.log()
          console.log(kleur.gray('Directory:'), stats.directory)
          console.log(kleur.gray('Default TTL:'), formatTtl(stats.defaultTtl))
          console.log(kleur.gray('Disk entries:'), stats.entries)
          console.log(kleur.gray('Session entries:'), stats.sessionEntries)
          console.log(kleur.gray('Total size:'), formatBytes(stats.totalSize))
          console.log()
        }
      } catch (error) {
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  // cache invalidate
  cache
    .command('invalidate')
    .argument('<namespace>', 'Registry namespace to invalidate (e.g., @acme)')
    .description('Invalidate cache for a specific registry')
    .action(async (namespace: string) => {
      const spinner = ora()

      try {
        const normalizedNamespace = namespace.startsWith('@') ? namespace : `@${namespace}`

        // Initialize cache and config
        const projectRoot = await findRepoRoot()
        if (projectRoot) {
          await configManager.loadProjectManifest(projectRoot)
        }
        const cacheDir = await configManager.getCacheDirectory()
        await registryClient.initCache({ directory: cacheDir })

        // Resolve the registry to get its URL
        spinner.start(`Resolving registry ${normalizedNamespace}...`)
        const registry = await resolveRegistry(normalizedNamespace)
        spinner.stop()

        spinner.start('Invalidating cache...')
        const invalidated = await registryClient.invalidateCache(registry)
        spinner.stop()

        if (invalidated) {
          console.log(kleur.green('✓') + ` Invalidated cache for ${kleur.bold(normalizedNamespace)}`)
        } else {
          console.log(kleur.gray(`No cache entry found for ${normalizedNamespace}`))
        }
      } catch (error) {
        spinner.fail('Failed to invalidate cache')
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  // cache config
  cache
    .command('config')
    .option('--json', 'Output as JSON')
    .description('Show current cache configuration')
    .action(async (options: { json?: boolean }) => {
      try {
        // Load configs
        const projectRoot = await findRepoRoot()
        if (projectRoot) {
          await configManager.loadProjectManifest(projectRoot)
        }

        const globalCache = await configManager.getGlobalCacheConfig()
        const projectCache = configManager.getProjectCacheConfig()
        const cacheDir = await configManager.getCacheDirectory()

        const config = {
          directory: cacheDir,
          global: {
            ttl: globalCache?.ttl,
            directory: globalCache?.directory,
          },
          project: projectRoot ? {
            ttl: projectCache?.ttl,
          } : null,
        }

        if (options.json) {
          console.log(JSON.stringify(config, null, 2))
        } else {
          console.log()
          console.log(kleur.bold('Cache Configuration'))
          console.log()
          console.log(kleur.gray('Effective directory:'), cacheDir)
          console.log()

          console.log(kleur.gray('Global config:'))
          if (globalCache) {
            console.log(`  TTL: ${globalCache.ttl !== undefined ? formatTtl(globalCache.ttl) : kleur.gray('(default)')}`)
            if (globalCache.directory) {
              console.log(`  Directory: ${globalCache.directory}`)
            }
          } else {
            console.log(kleur.gray('  (not configured)'))
          }
          console.log()

          if (projectRoot) {
            console.log(kleur.gray('Project config:'))
            if (projectCache) {
              console.log(`  TTL: ${projectCache.ttl !== undefined ? formatTtl(projectCache.ttl) : kleur.gray('(default)')}`)
            } else {
              console.log(kleur.gray('  (not configured)'))
            }
          } else {
            console.log(kleur.gray('Project config: N/A (not in a project)'))
          }
          console.log()
        }
      } catch (error) {
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  // cache reset
  cache
    .command('reset')
    .description('Reset cache configuration to defaults')
    .option('--clear', 'Also clear all cached data')
    .action(async (options: { clear?: boolean }) => {
      const spinner = ora()

      try {
        // Load global config
        await configManager.loadGlobalConfig()

        // Clear cache data if requested
        if (options.clear) {
          const cacheDir = await configManager.getCacheDirectory()
          await registryClient.initCache({ directory: cacheDir })

          spinner.start('Clearing cache...')
          const result = await registryClient.clearCache()
          spinner.stop()

          if (result.deleted > 0) {
            console.log(kleur.gray(`Cleared ${result.deleted} cached ${result.deleted === 1 ? 'entry' : 'entries'}`))
          }
        }

        // Reset cache config by removing it from global config
        spinner.start('Resetting cache configuration...')
        await configManager.resetGlobalCacheConfig()
        spinner.stop()

        console.log(kleur.green('✓') + ' Cache configuration reset to defaults')
        console.log()
        console.log(kleur.gray('Default settings:'))
        console.log(kleur.gray('  TTL: 3600s (1 hour)'))
        console.log(kleur.gray('  Directory: ~/.paradoc/cache'))
      } catch (error) {
        spinner.fail('Failed to reset cache configuration')
        console.error(kleur.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  return cache
}
