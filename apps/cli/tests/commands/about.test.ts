import { runCli as executeCliCommand } from '../setup/spawn-cli'
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('CLI about command', () => {
  it('should display full system information', async () => {
    const result = await executeCliCommand(['about'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Paradoc CLI')
    expect(result.stdout).toMatch(/Version:/)
    expect(result.stdout).toMatch(/Platform:/)
    expect(result.stdout).toMatch(/Node Version:/)
    expect(result.stdout).toMatch(/Working Dir:/)
  })

  it('should show a valid version number', async () => {
    const result = await executeCliCommand(['about'])

    expect(result.exitCode).toBe(0)
    // Version is either a semver or "dev"
    expect(result.stdout).toMatch(/Version:\s+(dev|\d+\.\d+\.\d+)/)
  })

  it('should show the current platform', async () => {
    const result = await executeCliCommand(['about'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain(process.platform)
  })

  it('should show the current node version', async () => {
    const result = await executeCliCommand(['about'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain(process.version)
  })
})
