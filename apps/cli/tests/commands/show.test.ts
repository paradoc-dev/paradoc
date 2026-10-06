import { runCli as executeCliCommand } from '../setup/spawn-cli'
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
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

  it('should show issuer, edition and full registry coordinates', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'paradoc-show-'))
    const file = path.join(dir, 'packet.json')
    writeFileSync(
      file,
      JSON.stringify({
        $schema: 'https://schema.paradoc.dev/2026-10-02.json',
        kind: 'bundle',
        name: 'packet',
        issuer: 'U.S. Internal Revenue Service',
        edition: { key: '2024-03', label: 'Rev. March 2024', date: '2024-03' },
        contents: [
          { type: 'registry', key: 'w9', slug: '@irs/forms/w-9', edition: '2024-03', version: '1.0.0' },
          { type: 'registry', key: 'plain', slug: '@irs/forms/w-4' },
        ],
      }),
    )
    const result = await executeCliCommand(['show', file])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Issuer:')
    expect(result.stdout).toContain('U.S. Internal Revenue Service')
    expect(result.stdout).toContain('Rev. March 2024 (2024-03)')
    expect(result.stdout).toContain('@irs/forms/w-9/2024-03@1.0.0 (registry)')
    expect(result.stdout).toContain('plain: @irs/forms/w-4 (registry)')
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
