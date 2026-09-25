import { runCli as executeCliCommand } from '../setup/spawn-cli'
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const fixturesDir = path.resolve(__dirname, '../fixtures')

describe('CLI show command', () => {
  const fixture = path.join(fixturesDir, 'pet-addendum.yaml')

  it('should show help', async () => {
    const result = await executeCliCommand(['show', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('--raw')
    expect(result.stdout).toContain('--deps')
  })

  it('should display artifact metadata', async () => {
    const result = await executeCliCommand(['show', fixture])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Artifact:')
    expect(result.stdout).toContain('Kind:')
    expect(result.stdout).toContain('form')
  })

  it('should show raw content with --raw', async () => {
    const result = await executeCliCommand(['show', fixture, '--raw'])

    expect(result.exitCode).toBe(0)
    // Raw output should contain the YAML source
    expect(result.stdout).toContain('kind:')
  })

  it('should show dependencies with --deps', async () => {
    const result = await executeCliCommand(['show', fixture, '--deps'])

    expect(result.exitCode).toBe(0)
    // Should either list deps or say "No file dependencies"
    const output = result.stdout
    expect(output.match(/dependencies|Artifact:/)).toBeTruthy()
  })

  it('should fail for non-existent file', async () => {
    const result = await executeCliCommand(['show', '/tmp/nonexistent.yaml'])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('File not found')
  })
})
