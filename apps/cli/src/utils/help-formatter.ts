import { Command } from 'commander'
import kleur from 'kleur'
import { brandColorBold } from '../constants.js'

/**
 * Command group definition for help output
 */
export interface CommandGroup {
  name: string
  commands: Command[]
}

/**
 * Format a command name with its alias for help display
 * Adds proper spacing: "list | ls" instead of "list|ls"
 */
function formatCommandName(cmd: Command): string {
  const name = cmd.name()
  const aliases = cmd.aliases()

  if (aliases.length > 0) {
    return `${name} | ${aliases.join(' | ')}`
  }
  return name
}

/**
 * Get the maximum command name width for alignment
 */
function getMaxCommandWidth(groups: CommandGroup[]): number {
  let maxWidth = 0
  for (const group of groups) {
    for (const cmd of group.commands) {
      const width = formatCommandName(cmd).length
      if (width > maxWidth) {
        maxWidth = width
      }
    }
  }
  return maxWidth
}

/**
 * Format grouped help output for the CLI
 */
export function formatGroupedHelp(
  program: Command,
  groups: CommandGroup[]
): string {
  const lines: string[] = []

  // Header
  lines.push('')
  lines.push(`${brandColorBold('Paradoc CLI')} ${kleur.gray('— Registry-first artifact manager')}`)
  lines.push('')

  // Usage
  lines.push(kleur.bold('Usage:'))
  lines.push(`  ${program.name()} [command] [options]`)
  lines.push('')

  // Calculate alignment
  const maxWidth = getMaxCommandWidth(groups)

  // Commands by group
  lines.push(kleur.bold('Commands:'))
  lines.push('')

  for (const group of groups) {
    // Group header
    lines.push(`  ${kleur.cyan(group.name)}`)

    // Commands in this group
    for (const cmd of group.commands) {
      const cmdName = formatCommandName(cmd)
      const padding = ' '.repeat(maxWidth - cmdName.length + 2)
      const description = cmd.description() || ''
      lines.push(`    ${kleur.white(cmdName)}${padding}${kleur.dim(description)}`)
    }

    lines.push('')
  }

  // Global options
  lines.push(kleur.bold('Options:'))
  lines.push(`  ${kleur.white('-v, --version')}  ${kleur.gray('Display version number')}`)
  lines.push(`  ${kleur.white('-h, --help')}     ${kleur.gray('Display help for command')}`)
  lines.push('')

  // Footer
  lines.push(kleur.gray(`Run '${program.name()} <command> -h' for help on a specific command.`))
  lines.push('')

  return lines.join('\n')
}

/**
 * Configure custom help for a program with grouped commands
 */
export function configureGroupedHelp(program: Command, groups: CommandGroup[]): void {
  program.configureHelp({
    formatHelp: () => formatGroupedHelp(program, groups)
  })
}
