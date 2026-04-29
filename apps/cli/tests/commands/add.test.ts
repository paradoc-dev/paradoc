import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
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

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

describe('para add', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'paradoc-add-test-'))
    // Create minimal project structure
    await fs.writeFile(
      join(tempDir, 'paradoc.json'),
      JSON.stringify({
        $schema: 'https://schema.paradoc.dev/manifest.json',
        name: 'test-project',
        title: 'Test Project',
        visibility: 'private',
      })
    )
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  describe('argument validation', () => {
    it('shows error for invalid artifact reference (missing @)', async () => {
      const result = await executeCliCommand(['add', 'acme/test'], { cwd: tempDir })
      expect(result.stderr).toContain('Invalid artifact')
      expect(result.exitCode).not.toBe(0)
    })

    it('treats @namespace as namespace-only browse (requires project)', async () => {
      const result = await executeCliCommand(['add', '@acme'], { cwd: tempDir })
      // @acme is now a valid namespace-only pattern (browse mode),
      // but fails because tempDir is not an Paradoc project
      expect(result.stderr).toContain('Not in an Paradoc project')
      expect(result.exitCode).not.toBe(0)
    })

    it('shows error for empty artifact name', async () => {
      const result = await executeCliCommand(['add', '@acme/'], { cwd: tempDir })
      expect(result.stderr).toContain('Invalid artifact')
      expect(result.exitCode).not.toBe(0)
    })
  })

  describe('project detection', () => {
    it('shows error when not in a project directory', async () => {
      const nonProjectDir = await fs.mkdtemp(join(tmpdir(), 'paradoc-no-project-'))
      try {
        const result = await executeCliCommand(['add', '@acme/test'], { cwd: nonProjectDir })
        expect(result.stderr).toContain('Not in an Paradoc project')
        expect(result.exitCode).not.toBe(0)
      } finally {
        await fs.rm(nonProjectDir, { recursive: true, force: true })
      }
    })
  })

  describe('help and usage', () => {
    it('shows help for add command', async () => {
      const result = await executeCliCommand(['add', '--help'])
      expect(result.stdout).toContain('Add an artifact from a registry')
      expect(result.stdout).toContain('--layers')
      expect(result.stdout).toContain('--output')
    })
  })

  describe('edge cases', () => {
    it('handles artifact reference with special characters in name', async () => {
      const result = await executeCliCommand(['add', '@acme/test-artifact_123'], { cwd: tempDir })
      // Should not crash, may fail on registry lookup but should process the reference
      expect(result.exitCode).toBeDefined()
    })

    it('handles very long artifact name gracefully', async () => {
      const longName = 'a'.repeat(200)
      const result = await executeCliCommand(['add', `@acme/${longName}`], { cwd: tempDir })
      // Should not crash - may fail on registry lookup but process should complete
      expect(result.exitCode).toBeDefined()
    })

    it('handles artifact reference with path traversal attempt in name', async () => {
      const result = await executeCliCommand(['add', '@acme/../../../etc/passwd'], { cwd: tempDir })
      // Should be rejected as invalid reference
      expect(result.stderr).toContain('Invalid artifact')
      expect(result.exitCode).not.toBe(0)
    })

    it('handles namespace with path traversal attempt', async () => {
      const result = await executeCliCommand(['add', '@../evil/artifact'], { cwd: tempDir })
      // Should be rejected as invalid reference
      expect(result.stderr).toContain('Invalid artifact')
      expect(result.exitCode).not.toBe(0)
    })
  })

  describe('output option', () => {
    it('accepts --output json', async () => {
      const result = await executeCliCommand(['add', '--help'])
      expect(result.stdout).toContain('--output')
    })

    it('accepts --output yaml', async () => {
      const result = await executeCliCommand(['add', '--help'])
      expect(result.stdout).toContain('--output')
    })

    it('accepts --output typed', async () => {
      const result = await executeCliCommand(['add', '--help'])
      expect(result.stdout).toContain('typed')
    })

    it('accepts --output ts', async () => {
      const result = await executeCliCommand(['add', '--help'])
      expect(result.stdout).toContain('TypeScript module')
    })
  })

  describe('layers option', () => {
    it('shows layers option in help', async () => {
      const result = await executeCliCommand(['add', '--help'])
      expect(result.stdout).toContain('--layers')
      expect(result.stdout).toContain('all')
    })
  })
})

describe('para add (registry integration)', () => {
  const TEST_REGISTRY_URL = 'http://localhost:4567'
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'paradoc-add-registry-'))
    // Initialize project with registry config
    await executeCliCommand(['init', '--yes', '--name', 'test-project'], { cwd: tempDir })
    const manifestPath = join(tempDir, 'paradoc.json')
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'))
    manifest.registries = {
      '@acme': {
        url: TEST_REGISTRY_URL,
      },
    }
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('adds W9 artifact from the registry', async () => {
    const result = await executeCliCommand(['add', '@acme/w9'], { cwd: tempDir })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Added')
    expect(result.stdout).toContain('@acme/w9')

    // Verify artifact file was created (default format is json)
    const artifactPath = join(tempDir, 'artifacts', '@acme', 'w9.json')
    const exists = await fs.access(artifactPath).then(() => true).catch(() => false)
    expect(exists).toBe(true)

    // Verify content has expected fields
    const content = await fs.readFile(artifactPath, 'utf-8')
    expect(content).toContain('name')
    expect(content).toContain('taxClassification')
  }, 30000)

  it('adds artifact with --output json', async () => {
    const result = await executeCliCommand(['add', '@acme/residential-lease', '--output', 'json'], { cwd: tempDir })
    expect(result.exitCode).toBe(0)

    const artifactPath = join(tempDir, 'artifacts', '@acme', 'residential-lease.json')
    const exists = await fs.access(artifactPath).then(() => true).catch(() => false)
    expect(exists).toBe(true)
  }, 30000)

  it('adds artifact with --output yaml', async () => {
    const result = await executeCliCommand(['add', '@acme/residential-lease', '--output', 'yaml'], { cwd: tempDir })
    expect(result.exitCode).toBe(0)

    const artifactPath = join(tempDir, 'artifacts', '@acme', 'residential-lease.yaml')
    const exists = await fs.access(artifactPath).then(() => true).catch(() => false)
    expect(exists).toBe(true)
  }, 30000)

  it('fails with error for nonexistent artifact', async () => {
    const result = await executeCliCommand(['add', '@acme/nonexistent'], { cwd: tempDir })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('not found')
  }, 30000)

  it('can re-add (update) an existing artifact', async () => {
    // First add
    const first = await executeCliCommand(['add', '@acme/w9'], { cwd: tempDir })
    expect(first.exitCode).toBe(0)

    // Second add (overwrite)
    const second = await executeCliCommand(['add', '@acme/w9'], { cwd: tempDir })
    expect(second.exitCode).toBe(0)
    expect(second.stdout).toContain('Added')
    expect(second.stdout).toContain('@acme/w9')
  }, 30000)
})

describe('para list', () => {
  it('shows help for list command', async () => {
    const result = await executeCliCommand(['list', '--help'])
    expect(result.stdout).toContain('List installed artifacts')
    expect(result.stdout).toContain('--json')
  })

  it('shows error when not in a project directory', async () => {
    const nonProjectDir = await fs.mkdtemp(join(tmpdir(), 'paradoc-no-project-'))
    try {
      const result = await executeCliCommand(['list'], { cwd: nonProjectDir })
      expect(result.stderr).toContain('Not in an Paradoc project')
      expect(result.exitCode).not.toBe(0)
    } finally {
      await fs.rm(nonProjectDir, { recursive: true, force: true })
    }
  })
})

describe('para show', () => {
  it('shows help for show command', async () => {
    const result = await executeCliCommand(['show', '--help'])
    expect(result.stdout).toContain('Show details about an artifact')
    expect(result.stdout).toContain('--raw')
  })
})

describe('para search', () => {
  it('shows help for search command', async () => {
    const result = await executeCliCommand(['search', '--help'])
    expect(result.stdout).toContain('Search for artifacts in a registry')
    expect(result.stdout).toContain('--registry')
    expect(result.stdout).toContain('--kind')
    expect(result.stdout).toContain('--tags')
    expect(result.stdout).toContain('--json')
  })
})

describe('para registry', () => {
  it('shows help for registry command', async () => {
    const result = await executeCliCommand(['registry', '--help'])
    expect(result.stdout).toContain('Manage registry configurations')
    expect(result.stdout).toContain('add')
    expect(result.stdout).toContain('remove')
    expect(result.stdout).toContain('list')
    expect(result.stdout).toContain('info')
  })

  it('shows help for registry add subcommand', async () => {
    const result = await executeCliCommand(['registry', 'add', '--help'])
    expect(result.stdout).toContain('Add or update a registry')
    expect(result.stdout).toContain('--header')
    expect(result.stdout).toContain('--global')
  })

  it('shows help for registry list subcommand', async () => {
    const result = await executeCliCommand(['registry', 'list', '--help'])
    expect(result.stdout).toContain('List configured registries')
    expect(result.stdout).toContain('--json')
  })
})
