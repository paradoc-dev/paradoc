import { runCli as executeCliCommand } from '../setup/spawn-cli'
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const fixturesDir = path.resolve(__dirname, '../fixtures')

describe('CLI fix command', () => {
  const fixture = path.join(fixturesDir, 'pet-addendum.yaml')

  it('should show help', async () => {
    const result = await executeCliCommand(['fix', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('--yes')
    expect(result.stdout).toContain('--dry-run')
  })

  it('should report no changes needed for inline layers', async () => {
    const result = await executeCliCommand(['fix', fixture, '--yes'])

    expect(result.exitCode).toBe(0)
    const output = result.stdout + result.stderr
    // Inline-only artifact has no file-backed layers to fix
    expect(output).toMatch(/No (file-backed )?layers to fix|No changes needed|checksums are valid/i)
  })

  it('should support dry-run on a file-backed artifact', async () => {
    const pdfFixture = path.join(fixturesDir, 'pet-addendum-pdf.yaml')
    const result = await executeCliCommand(['fix', pdfFixture, '--dry-run', '--yes'])

    expect(result.exitCode).toBe(0)
    // Either "No changes needed" or "Dry run: No changes written"
    const output = result.stdout + result.stderr
    expect(output).toMatch(/No changes|Dry run/i)
  })

  it('should fail for non-existent file', async () => {
    const result = await executeCliCommand(['fix', '/tmp/nonexistent.yaml'])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Error')
  })
})
