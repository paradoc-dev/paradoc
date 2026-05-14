import { Command } from 'commander'
import kleur from 'kleur'
import prompts from 'prompts'

import type { GlobalConfig, OutputFormat } from '../types.js'
import { configManager } from '../utils/config.js'
import { DEFAULT_CACHE_TTL } from '../utils/cache.js'

/**
 * Format TTL to human-readable string
 */
function formatTtl(seconds: number): string {
  if (seconds === 0) return 'disabled'
  if (seconds < 60) return `${seconds} seconds`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600)
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
  }
  const days = Math.floor(seconds / 86400)
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

/**
 * Create the 'configure' command
 * Interactive configuration wizard
 */
export function createConfigureCommand(): Command {
  const configure = new Command('configure')

  configure
    .description('Interactive configuration wizard for Paradoc CLI')
    .alias('config')
    .action(async () => {
      console.log()
      console.log(kleur.bold().cyan('Paradoc CLI Configuration'))
      console.log(kleur.gray('Walk through each setting to configure the CLI.'))
      console.log(kleur.gray('Press Enter to keep the current value, or select a new one.'))
      console.log()

      // Load current config
      const currentConfig = await configManager.loadGlobalConfig()

      // Track new values
      const currentOutput = currentConfig.defaults?.output ?? 'json'
      const currentArtifactsDir = currentConfig.defaults?.artifactsDir ?? 'artifacts'
      const currentRegistry = currentConfig.defaults?.registry
      const currentCacheTtl = currentConfig.cache?.ttl ?? DEFAULT_CACHE_TTL

      // Get configured registries for selection
      const configuredRegistries = Object.keys(currentConfig.registries ?? {})

      // ═══════════════════════════════════════════════════════════════════════
      // Step 1: Output Format
      // ═══════════════════════════════════════════════════════════════════════
      console.log(kleur.gray('─'.repeat(50)))
      console.log()
      console.log(kleur.bold().white('1. Output Format'))
      console.log(kleur.gray('   How artifacts are saved when downloaded from a registry.'))
      console.log()

      const outputChoices = [
        {
          title: 'JSON' + kleur.gray(' — Portable, widely supported'),
          value: 'json',
        },
        {
          title: 'YAML' + kleur.gray(' — Human-readable, easy to edit'),
          value: 'yaml',
        },
        {
          title: 'Typed' + kleur.gray(' — JSON + TypeScript declarations (.d.ts)'),
          value: 'typed',
        },
        {
          title: 'TypeScript' + kleur.gray(' — Full TS modules with embedded types'),
          value: 'ts',
        },
      ]

      // Mark current selection
      const currentOutputIndex = ['json', 'yaml', 'typed', 'ts'].indexOf(currentOutput)

      const { output } = await prompts({
        type: 'select',
        name: 'output',
        message: `Output format ${kleur.green(`(current: ${currentOutput})`)}`,
        choices: outputChoices,
        initial: currentOutputIndex,
      })

      if (output === undefined) {
        console.log()
        console.log(kleur.gray('Configuration cancelled.'))
        return
      }

      // ═══════════════════════════════════════════════════════════════════════
      // Step 2: Artifacts Directory
      // ═══════════════════════════════════════════════════════════════════════
      console.log()
      console.log(kleur.gray('─'.repeat(50)))
      console.log()
      console.log(kleur.bold().white('2. Artifacts Directory'))
      console.log(kleur.gray('   Where downloaded artifacts are stored in your projects.'))
      console.log(kleur.gray('   Relative to project root (where paradoc.json is).'))
      console.log()

      const { artifactsDir } = await prompts({
        type: 'text',
        name: 'artifactsDir',
        message: `Directory name ${kleur.green(`(current: ${currentArtifactsDir})`)}`,
        initial: currentArtifactsDir,
        validate: (value: string) => {
          if (!value.trim()) return 'Directory name cannot be empty'
          if (value.includes('..')) return 'Cannot contain ".."'
          return true
        },
      })

      if (artifactsDir === undefined) {
        console.log()
        console.log(kleur.gray('Configuration cancelled.'))
        return
      }

      // ═══════════════════════════════════════════════════════════════════════
      // Step 3: Cache TTL
      // ═══════════════════════════════════════════════════════════════════════
      console.log()
      console.log(kleur.gray('─'.repeat(50)))
      console.log()
      console.log(kleur.bold().white('3. Cache Duration'))
      console.log(kleur.gray('   How long to cache registry data before fetching fresh.'))
      console.log(kleur.gray('   Higher = fewer requests, lower = fresher data.'))
      console.log()

      const ttlChoices = [
        { title: '5 minutes', value: 300 },
        { title: '30 minutes', value: 1800 },
        { title: '1 hour' + kleur.gray(' — recommended'), value: 3600 },
        { title: '4 hours', value: 14400 },
        { title: '1 day', value: 86400 },
        { title: 'Disabled' + kleur.gray(' — always fetch fresh'), value: 0 },
        { title: 'Custom...' + kleur.gray(' — enter seconds'), value: -1 },
      ]

      // Find current TTL in choices or default to custom
      let ttlInitial = ttlChoices.findIndex(c => c.value === currentCacheTtl)
      if (ttlInitial === -1) ttlInitial = 6 // Custom

      const { cacheTtlChoice } = await prompts({
        type: 'select',
        name: 'cacheTtlChoice',
        message: `Cache TTL ${kleur.green(`(current: ${formatTtl(currentCacheTtl)})`)}`,
        choices: ttlChoices,
        initial: ttlInitial,
      })

      if (cacheTtlChoice === undefined) {
        console.log()
        console.log(kleur.gray('Configuration cancelled.'))
        return
      }

      let cacheTtl = cacheTtlChoice
      if (cacheTtlChoice === -1) {
        // Custom TTL
        const { customTtl } = await prompts({
          type: 'number',
          name: 'customTtl',
          message: 'Enter TTL in seconds (0 to disable)',
          initial: currentCacheTtl,
          min: 0,
          max: 604800, // 1 week
        })

        if (customTtl === undefined) {
          console.log()
          console.log(kleur.gray('Configuration cancelled.'))
          return
        }
        cacheTtl = customTtl
      }

      // ═══════════════════════════════════════════════════════════════════════
      // Step 4: Default Registry
      // ═══════════════════════════════════════════════════════════════════════
      console.log()
      console.log(kleur.gray('─'.repeat(50)))
      console.log()
      console.log(kleur.bold().white('4. Default Registry'))
      console.log(kleur.gray('   Registry to use when no namespace is specified.'))
      console.log(kleur.gray('   Leave unset to require explicit @namespace/artifact.'))
      console.log()

      let defaultRegistry: string | undefined = currentRegistry

      if (configuredRegistries.length === 0) {
        console.log(kleur.gray('   No registries configured. Skipping.'))
        console.log(kleur.gray('   Run ' + kleur.white('para registry add') + ' to add registries.'))
      } else {
        const registryChoices = [
          {
            title: 'None' + kleur.gray(' — always require @namespace'),
            value: '',
          },
          ...configuredRegistries.map(ns => ({
            title: ns + kleur.gray(currentRegistry === ns ? ' — current default' : ''),
            value: ns,
          })),
        ]

        // Find current selection index
        let registryInitial = 0
        if (currentRegistry) {
          const idx = configuredRegistries.indexOf(currentRegistry)
          if (idx !== -1) registryInitial = idx + 1
        }

        const { registry } = await prompts({
          type: 'select',
          name: 'registry',
          message: `Default registry ${kleur.green(`(current: ${currentRegistry ?? 'none'})`)}`,
          choices: registryChoices,
          initial: registryInitial,
        })

        if (registry === undefined) {
          console.log()
          console.log(kleur.gray('Configuration cancelled.'))
          return
        }

        defaultRegistry = registry || undefined
      }

      // ═══════════════════════════════════════════════════════════════════════
      // Step 5: Telemetry
      // ═══════════════════════════════════════════════════════════════════════
      console.log()
      console.log(kleur.gray('─'.repeat(50)))
      console.log()
      console.log(kleur.bold().white('5. Telemetry'))
      console.log(kleur.gray('   Anonymous usage data helps improve the CLI.'))
      console.log(kleur.gray('   No personal or project data is collected.'))
      console.log()

      const currentTelemetryEnabled = currentConfig.telemetry?.enabled !== false

      const { telemetryEnabled } = await prompts({
        type: 'select',
        name: 'telemetryEnabled',
        message: `Telemetry ${kleur.green(`(current: ${currentTelemetryEnabled ? 'enabled' : 'disabled'})`)}`,
        choices: [
          { title: 'Enabled' + kleur.gray(' — help improve the CLI'), value: true },
          { title: 'Disabled' + kleur.gray(' — no data sent'), value: false },
        ],
        initial: currentTelemetryEnabled ? 0 : 1,
      })

      if (telemetryEnabled === undefined) {
        console.log()
        console.log(kleur.gray('Configuration cancelled.'))
        return
      }

      // ═══════════════════════════════════════════════════════════════════════
      // Summary
      // ═══════════════════════════════════════════════════════════════════════
      console.log()
      console.log(kleur.gray('─'.repeat(50)))
      console.log()
      console.log(kleur.bold().cyan('Summary'))
      console.log()

      // Show what changed
      const outputChanged = output !== currentOutput
      const artifactsDirChanged = artifactsDir.trim() !== currentArtifactsDir
      const cacheTtlChanged = cacheTtl !== currentCacheTtl
      const registryChanged = defaultRegistry !== currentRegistry
      const telemetryChanged = telemetryEnabled !== currentTelemetryEnabled

      const formatValue = (value: string, changed: boolean) =>
        changed ? kleur.green(value) : kleur.white(value)

      console.log(`  Output format:     ${formatValue(output.toUpperCase(), outputChanged)}${outputChanged ? kleur.yellow(' (changed)') : ''}`)
      console.log(`  Artifacts dir:     ${formatValue(artifactsDir.trim(), artifactsDirChanged)}${artifactsDirChanged ? kleur.yellow(' (changed)') : ''}`)
      console.log(`  Cache TTL:         ${formatValue(formatTtl(cacheTtl), cacheTtlChanged)}${cacheTtlChanged ? kleur.yellow(' (changed)') : ''}`)
      console.log(`  Default registry:  ${formatValue(defaultRegistry ?? 'none', registryChanged)}${registryChanged ? kleur.yellow(' (changed)') : ''}`)
      console.log(`  Telemetry:         ${formatValue(telemetryEnabled ? 'enabled' : 'disabled', telemetryChanged)}${telemetryChanged ? kleur.yellow(' (changed)') : ''}`)
      console.log()

      const anyChanged = outputChanged || artifactsDirChanged || cacheTtlChanged || registryChanged || telemetryChanged

      if (!anyChanged) {
        console.log(kleur.gray('No changes made.'))
        return
      }

      const { confirm } = await prompts({
        type: 'confirm',
        name: 'confirm',
        message: 'Save these settings?',
        initial: true,
      })

      if (!confirm) {
        console.log()
        console.log(kleur.gray('Configuration cancelled.'))
        return
      }

      // Build and save config
      const newConfig: GlobalConfig = {
        $schema: 'https://schema.paradoc.dev/config.json',
        registries: currentConfig.registries ?? {},
        defaults: {
          output: output as OutputFormat,
          artifactsDir: artifactsDir.trim(),
          ...(defaultRegistry && { registry: defaultRegistry }),
        },
        cache: {
          ttl: cacheTtl,
        },
        telemetry: {
          enabled: telemetryEnabled,
        },
        // Preserve anonymous ID across config saves
        ...(currentConfig.anonymousId && { anonymousId: currentConfig.anonymousId }),
      }

      await configManager.saveGlobalConfig(newConfig)

      console.log()
      console.log(kleur.green('✓') + ' Configuration saved to ' + kleur.gray('~/.paradoc/config.json'))
    })

  return configure
}
