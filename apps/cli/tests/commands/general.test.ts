import { runCli as executeCliCommand } from '../setup/spawn-cli'
import { describe, it, expect } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Execute a CLI command and return the result
 */

describe('CLI General Commands', () => {
  describe('help command', () => {
    it('should display help with --help flag', async () => {
      const result = await executeCliCommand(['--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Usage:')
      expect(result.stdout).toContain('paradoc')
    })

    it('should display help with -h flag', async () => {
      const result = await executeCliCommand(['-h'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Usage:')
      expect(result.stdout).toContain('paradoc')
    })

    it('prints command help for -h before a command', async () => {
      const result = await executeCliCommand(['-h', 'add'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Usage: paradoc add')
    })

    it('rejects an unknown command even when help is requested', async () => {
      const result = await executeCliCommand(['unknown-command', '--help'])

      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain("unknown command 'unknown-command'")
    })

    it('lists every registered global option', async () => {
      const result = await executeCliCommand(['--help'])

      expect(result.stdout).toContain('--no-telemetry')
    })

    it('prints the update notice after asynchronous command output', async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'paradoc-update-order-'))
      const home = path.join(root, 'home')
      const preload = path.join(root, 'tty.mjs')
      try {
        await fs.mkdir(path.join(home, '.paradoc'), { recursive: true })
        await fs.writeFile(
          path.join(home, '.paradoc', 'update-check.json'),
          JSON.stringify({ lastChecked: Date.now(), latestVersion: '99.0.0' }),
        )
        await fs.writeFile(preload, "Object.defineProperty(process.stdout, 'isTTY', { value: true })\n")

        const result = await executeCliCommand(['cache', 'info'], {
          cwd: root,
          target: 'dist',
          nodeArgs: ['--import', preload],
          env: { HOME: home, CI: undefined, PARADOC_NO_UPDATE_CHECK: undefined, NO_COLOR: '1' },
        })
        expect(result.exitCode).toBe(0)
        expect(result.stdout.indexOf('Cache Statistics')).toBeLessThan(
          result.stdout.indexOf('Update available'),
        )
      } finally {
        await fs.rm(root, { recursive: true, force: true })
      }
    })

    it('should list all available commands', async () => {
      const result = await executeCliCommand(['--help'])

      expect(result.exitCode).toBe(0)
      // Core commands (registry-first approach)
      expect(result.stdout).toContain('init')
      expect(result.stdout).toContain('add')
      expect(result.stdout).toContain('diff')
      expect(result.stdout).toContain('show')
      // Artifact commands
      expect(result.stdout).toContain('new')
      expect(result.stdout).toContain('validate')
      expect(result.stdout).toContain('fix')
      expect(result.stdout).toContain('render')
      expect(result.stdout).toContain('attach')
      expect(result.stdout).toContain('inspect')
      // Data commands
      expect(result.stdout).toContain('data')
      // Utility commands
      expect(result.stdout).toContain('about')
      expect(result.stdout).toContain('docs')
      expect(result.stdout).toContain('console')
      expect(result.stdout).toContain('apply')
      expect(result.stdout).toContain('version')
    })

    it('should show help when no arguments provided', async () => {
      const result = await executeCliCommand([])

      // When no arguments are provided, Commander.js may output to stdout or stderr
      const output = result.stdout + result.stderr
      expect(output).toContain('Usage:')
      expect(output).toContain('paradoc')
    })

    it('should print the same help for bare help as for --help', async () => {
      const [viaCommand, viaFlag] = await Promise.all([
        executeCliCommand(['help']),
        executeCliCommand(['--help']),
      ])

      expect(viaCommand.exitCode).toBe(0)
      expect(viaCommand.stderr).not.toContain('unknown command')
      expect(viaCommand.stdout).toContain('Usage:')
      expect(viaCommand.stdout).toBe(viaFlag.stdout)
    })

    it('should print the same help for help <command> as for <command> --help', async () => {
      const [viaCommand, viaFlag] = await Promise.all([
        executeCliCommand(['help', 'add']),
        executeCliCommand(['add', '--help']),
      ])

      expect(viaCommand.exitCode).toBe(0)
      expect(viaCommand.stderr).not.toContain('unknown command')
      expect(viaCommand.stdout).toContain('Usage: paradoc add')
      expect(viaCommand.stdout).toBe(viaFlag.stdout)
    })

    it('should print nested subcommand help for help <command> <subcommand>', async () => {
      const result = await executeCliCommand(['help', 'registry', 'add'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Usage: paradoc registry add')
    })

    it('should still reject an unknown command', async () => {
      const result = await executeCliCommand(['bogus'])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain("unknown command 'bogus'")
    })
  })

  describe('version command', () => {
    it('should display version with --version flag', async () => {
      const result = await executeCliCommand(['--version'])

      expect(result.exitCode).toBe(0)
      // Via tsx __VERSION__ is not injected, so falls back to 'dev'
      expect(result.stdout).toMatch(/(\d+\.\d+\.\d+|dev)/)
    })

    it('should display version with -v flag', async () => {
      const result = await executeCliCommand(['-v'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/(\d+\.\d+\.\d+|dev)/)
    })
  })

  describe('unknown command', () => {
    it('should show error for unknown commands', async () => {
      const result = await executeCliCommand(['unknowncommand'])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain("unknown command 'unknowncommand'")
    })
  })

  describe('init command options', () => {
    it('shows all init options in help', async () => {
      const result = await executeCliCommand(['init', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('--name')
      expect(result.stdout).toContain('--yes')
      expect(result.stdout).toContain('--dry-run')
      expect(result.stdout).toContain('--visibility')
    })
  })

  describe('new command options', () => {
    it('shows new command subcommands', async () => {
      const result = await executeCliCommand(['new', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('form')
      expect(result.stdout).toContain('checklist')
      expect(result.stdout).toContain('document')
      expect(result.stdout).toContain('bundle')
    })

    it('shows form options in help', async () => {
      const result = await executeCliCommand(['new', 'form', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('--slug')
      expect(result.stdout).toContain('--title')
      expect(result.stdout).toContain('--format')
      expect(result.stdout).toContain('--dry-run')
    })

    it('shows checklist options in help', async () => {
      const result = await executeCliCommand(['new', 'checklist', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('--slug')
      expect(result.stdout).toContain('--format')
    })

    it('shows document options in help', async () => {
      const result = await executeCliCommand(['new', 'document', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('--slug')
      expect(result.stdout).toContain('--format')
    })

    it('shows bundle options in help', async () => {
      const result = await executeCliCommand(['new', 'bundle', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('--slug')
      expect(result.stdout).toContain('--format')
    })
  })

  describe('validate command options', () => {
    it('shows validate options in help', async () => {
      const result = await executeCliCommand(['validate', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('--json')
      expect(result.stdout).not.toContain('--layers-only')
    })
  })

  describe('render command options', () => {
    it('shows render options in help', async () => {
      const result = await executeCliCommand(['render', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('--out')
      expect(result.stdout).toContain('--layer')
      expect(result.stdout).toContain('--format')
    })
  })

  describe('data command options', () => {
    it('shows data subcommands', async () => {
      const result = await executeCliCommand(['data', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('fill')
      expect(result.stdout).toContain('template')
    })

    it('shows data fill options', async () => {
      const result = await executeCliCommand(['data', 'fill', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('--out')
    })

    it('shows data template options', async () => {
      const result = await executeCliCommand(['data', 'template', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('--out')
    })
  })

})
