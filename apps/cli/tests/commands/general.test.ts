import { describe, it, expect } from 'vitest'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Execute a CLI command and return the result
 */
async function executeCliCommand(
  args: string[],
  options?: {
    cwd?: string
    env?: Record<string, string>
    timeout?: number
  }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const cliPath = path.resolve(__dirname, '../../src/index.ts')
    const child = spawn('tsx', [cliPath, ...args], {
      cwd: options?.cwd || process.cwd(),
      env: { ...process.env, ...options?.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    const timeout = options?.timeout || 30000
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`Command timed out after ${timeout}ms`))
    }, timeout)

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 0,
      })
    })

    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}

describe('CLI General Commands', () => {
  describe('help command', () => {
    it('should display help with --help flag', async () => {
      const result = await executeCliCommand(['--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Usage:')
      expect(result.stdout).toContain('para')
    })

    it('should display help with -h flag', async () => {
      const result = await executeCliCommand(['-h'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Usage:')
      expect(result.stdout).toContain('para')
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
      expect(output).toContain('para')
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
