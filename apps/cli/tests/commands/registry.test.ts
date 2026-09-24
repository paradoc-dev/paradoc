import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { PARADOC_SCHEMA_URL } from '@paradoc/schemas'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function executeCliCommand(
  args: string[],
  options?: {
    cwd?: string
    env?: Record<string, string>
    timeout?: number
    /** Written to the child's stdin, which is then closed. */
    input?: string
  }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const cliPath = path.resolve(__dirname, '../../src/index.ts')
    const child = spawn('tsx', [cliPath, ...args], {
      cwd: options?.cwd || process.cwd(),
      env: { ...process.env, ...options?.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    if (options?.input !== undefined) {
      child.stdin.end(options.input)
    }

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
      resolve({ stdout, stderr, exitCode: code ?? 0 })
    })

    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}

describe('CLI Registry Command', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paradoc-registry-test-'))
  })

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('registry --help', () => {
    it('should list all subcommands', async () => {
      const result = await executeCliCommand(['registry', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('add')
      expect(result.stdout).toContain('remove')
      expect(result.stdout).toContain('list')
      expect(result.stdout).toContain('make')
      expect(result.stdout).toContain('info')
      expect(result.stdout).toContain('catalog')
      expect(result.stdout).toContain('stats')
      expect(result.stdout).toContain('compile')
      expect(result.stdout).toContain('view')
    })
  })

  describe('registry list', () => {
    it('should list registries with --json', async () => {
      const globalDir = path.join(tempDir, 'global')
      await fs.mkdir(path.join(globalDir, '.paradoc'), { recursive: true })
      await fs.writeFile(
        path.join(globalDir, '.paradoc', 'config.json'),
        JSON.stringify({
          registries: {
            '@test': 'https://example.com/registry',
          },
        })
      )

      const result = await executeCliCommand(['registry', 'list', '--json'], {
        env: { HOME: globalDir, XDG_CONFIG_HOME: path.join(globalDir, '.paradoc') },
      })

      expect(result.exitCode).toBe(0)
      const parsed = JSON.parse(result.stdout)
      expect(Array.isArray(parsed)).toBe(true)
    })

    it('should show registries in human format', async () => {
      const globalDir = path.join(tempDir, 'global')
      await fs.mkdir(path.join(globalDir, '.paradoc'), { recursive: true })
      await fs.writeFile(
        path.join(globalDir, '.paradoc', 'config.json'),
        JSON.stringify({
          registries: {
            '@test': 'https://example.com/registry',
          },
        })
      )

      const result = await executeCliCommand(['registry', 'list'], {
        env: { HOME: globalDir, XDG_CONFIG_HOME: path.join(globalDir, '.paradoc') },
      })

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('@test')
    })
  })

  describe('registry make', () => {
    it('should create a registry.json with --yes --name', async () => {
      const result = await executeCliCommand(
        ['registry', 'make', tempDir, '--yes', '--name', 'test-registry'],
      )

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('test-registry')

      // Verify file was created
      const content = await fs.readFile(path.join(tempDir, 'registry.json'), 'utf-8')
      const registry = JSON.parse(content)
      expect(registry.name).toBe('test-registry')
    })

    it('should create registry with description and homepage', async () => {
      const result = await executeCliCommand(
        ['registry', 'make', tempDir, '--yes', '--name', 'my-reg', '--description', 'A test registry', '--homepage', 'https://example.com'],
      )

      expect(result.exitCode).toBe(0)

      const content = await fs.readFile(path.join(tempDir, 'registry.json'), 'utf-8')
      const registry = JSON.parse(content)
      expect(registry.name).toBe('my-reg')
      expect(registry.description).toBe('A test registry')
      expect(registry.homepage).toBe('https://example.com')
    })

    it('should slugify invalid names in --yes mode', async () => {
      const result = await executeCliCommand(
        ['registry', 'make', tempDir, '--yes', '--name', 'My Registry!'],
      )

      expect(result.exitCode).toBe(0)

      const content = await fs.readFile(path.join(tempDir, 'registry.json'), 'utf-8')
      const registry = JSON.parse(content)
      // Should be slugified to lowercase with hyphens
      expect(registry.name).toMatch(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/)
    })

    it('should use --artifacts-path option', async () => {
      const result = await executeCliCommand(
        ['registry', 'make', tempDir, '--yes', '--name', 'test-reg', '--artifacts-path', '/r'],
      )

      expect(result.exitCode).toBe(0)

      const content = await fs.readFile(path.join(tempDir, 'registry.json'), 'utf-8')
      const registry = JSON.parse(content)
      expect(registry.artifactsPath).toBe('/r')
    })

    it('should support --no-directory flag', async () => {
      const result = await executeCliCommand(
        ['registry', 'make', tempDir, '--yes', '--name', 'test-reg', '--no-directory'],
      )

      expect(result.exitCode).toBe(0)

      const content = await fs.readFile(path.join(tempDir, 'registry.json'), 'utf-8')
      const registry = JSON.parse(content)
      expect(registry.enableDirectory).toBe(false)
      // Note: --no-telemetry is shadowed by the root program's identically-named
      // option, so `make --no-telemetry` does not propagate to the subcommand.
      // enableTelemetry defaults to true here.
      expect(registry.enableTelemetry).toBe(true)
    })
  })

  describe('registry add', () => {
    it('refuses @paradoc, which is reserved, and writes no config', async () => {
      const home = path.join(tempDir, 'home')
      await fs.mkdir(home, { recursive: true })

      for (const namespace of ['@paradoc', 'paradoc', '@PARADOC']) {
        const result = await executeCliCommand(
          ['registry', 'add', namespace, 'https://evil.example', '--global'],
          { cwd: tempDir, env: { HOME: home } }
        )

        expect(result.exitCode).toBe(1)
        expect(result.stderr).toContain('is reserved and always resolves to https://registry.paradoc.dev')
      }
      await expect(fs.access(path.join(home, '.paradoc', 'config.json'))).rejects.toThrow()
    })

    it('adds any other namespace', async () => {
      const home = path.join(tempDir, 'home')
      await fs.mkdir(home, { recursive: true })

      const result = await executeCliCommand(
        ['registry', 'add', '@acme', 'https://registry.acme.com', '--global'],
        { cwd: tempDir, env: { HOME: home } }
      )

      expect(result.exitCode).toBe(0)
      const config = JSON.parse(await fs.readFile(path.join(home, '.paradoc', 'config.json'), 'utf-8'))
      expect(config.registries).toEqual({ '@acme': 'https://registry.acme.com' })
    })
  })

  describe('registry remove', () => {
    it('should show error for non-existent namespace with --global', async () => {
      const globalDir = path.join(tempDir, 'global')
      await fs.mkdir(path.join(globalDir, '.paradoc'), { recursive: true })
      await fs.writeFile(
        path.join(globalDir, '.paradoc', 'config.json'),
        JSON.stringify({ registries: {} })
      )

      const result = await executeCliCommand(
        ['registry', 'remove', '@nonexistent', '--global'],
        { env: { HOME: globalDir, XDG_CONFIG_HOME: path.join(globalDir, '.paradoc') } }
      )

      // Should succeed but report not found
      const output = result.stdout + result.stderr
      expect(output).toMatch(/not found|no registr/i)
    })

    /** Ctrl+C: cancels the selection prompt once it has listed its choices. */
    const CANCEL = '\u0003'

    /** A project and a home that both configure @acme, plus one registry each of their own. */
    async function projectWithBothScopes(): Promise<{ project: string; home: string }> {
      const home = path.join(tempDir, 'home')
      const project = path.join(tempDir, 'project')
      await fs.mkdir(path.join(home, '.paradoc'), { recursive: true })
      await fs.mkdir(path.join(project, '.paradoc'), { recursive: true })
      await fs.writeFile(
        path.join(home, '.paradoc', 'config.json'),
        JSON.stringify({ registries: { '@acme': 'https://global.acme.example', '@global-only': 'https://global-only.example' } })
      )
      await fs.writeFile(
        path.join(project, 'paradoc.json'),
        JSON.stringify({
          name: '@test/test-project',
          title: 'Test Project',
          visibility: 'private',
          registries: { '@acme': 'https://project.acme.example', '@project-only': 'https://project-only.example' },
        })
      )
      return { project, home }
    }

    it('offers only global registries with --global', async () => {
      const { project, home } = await projectWithBothScopes()

      const result = await executeCliCommand(['registry', 'remove', '--global'], { cwd: project, env: { HOME: home }, input: CANCEL })

      expect(result.stdout).toContain('https://global.acme.example')
      expect(result.stdout).toContain('@global-only')
      expect(result.stdout).not.toContain('https://project.acme.example')
      expect(result.stdout).not.toContain('@project-only')
    })

    it('offers only project registries with --project', async () => {
      const { project, home } = await projectWithBothScopes()

      const result = await executeCliCommand(['registry', 'remove', '--project'], { cwd: project, env: { HOME: home }, input: CANCEL })

      expect(result.stdout).toContain('https://project.acme.example')
      expect(result.stdout).toContain('@project-only')
      expect(result.stdout).not.toContain('https://global.acme.example')
      expect(result.stdout).not.toContain('@global-only')
    })

    it('says so when the chosen scope has no registries', async () => {
      const home = path.join(tempDir, 'home')
      await fs.mkdir(home, { recursive: true })

      const result = await executeCliCommand(['registry', 'remove', '--global'], { cwd: tempDir, env: { HOME: home } })

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('No registries in global config.')
    })
  })

  describe('registry stats', () => {
    it('should show stats for a local registry.json', async () => {
      // Create a registry.json with items
      await fs.writeFile(
        path.join(tempDir, 'registry.json'),
        JSON.stringify({
          $schema: 'https://paradoc.sh/schemas/registry.json',
          name: 'test-registry',
          items: [
            { name: 'my-form', kind: 'form', version: '1.0.0' },
            { name: 'my-doc', kind: 'document', version: '1.0.0' },
            { name: 'another-form', kind: 'form', version: '2.0.0' },
          ],
        })
      )

      const result = await executeCliCommand(
        ['registry', 'stats', '--registry', path.join(tempDir, 'registry.json')],
      )

      expect(result.exitCode).toBe(0)
      const output = result.stdout
      expect(output).toContain('test-registry')
      expect(output).toContain('3') // total count
    })

    it('should output stats as JSON', async () => {
      await fs.writeFile(
        path.join(tempDir, 'registry.json'),
        JSON.stringify({
          $schema: 'https://paradoc.sh/schemas/registry.json',
          name: 'test-registry',
          items: [
            { name: 'my-form', kind: 'form', version: '1.0.0' },
          ],
        })
      )

      const result = await executeCliCommand(
        ['registry', 'stats', '--registry', path.join(tempDir, 'registry.json'), '--json'],
      )

      expect(result.exitCode).toBe(0)
      const parsed = JSON.parse(result.stdout)
      expect(parsed.name).toBe('test-registry')
      expect(parsed.totalArtifacts).toBe(1)
      expect(parsed.byKind).toHaveProperty('form', 1)
    })

    it('rejects a namespace argument: stats read a local registry.json only', async () => {
      const result = await executeCliCommand(['registry', 'stats', '@ns'], { cwd: tempDir })

      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain('too many arguments')
      expect(result.stdout).not.toContain('not yet implemented')
    })

    it('should show error for nonexistent registry.json', async () => {
      const result = await executeCliCommand(
        ['registry', 'stats', '--registry', path.join(tempDir, 'nope.json')],
      )

      expect(result.exitCode).toBe(1)
    })
  })

  describe('registry catalog add', () => {
    it('should add an artifact to a registry', async () => {
      // Resolve realpath to avoid macOS /var → /private/var symlink mismatch
      const realTempDir = await fs.realpath(tempDir)

      // Create registry.json
      await fs.writeFile(
        path.join(realTempDir, 'registry.json'),
        JSON.stringify({
          $schema: 'https://paradoc.sh/schemas/registry.json',
          name: 'test-registry',
          items: [],
        })
      )

      // Create a valid form artifact
      await fs.writeFile(
        path.join(realTempDir, 'my-form.json'),
        JSON.stringify({
          $schema: PARADOC_SCHEMA_URL,
          kind: 'form',
          name: 'my-form',
          version: '1.0.0',
          title: 'My Form',
          fields: {
            name: { type: 'text', label: 'Name', required: true },
          },
        })
      )

      const result = await executeCliCommand(
        ['registry', 'catalog', 'add', path.join(realTempDir, 'my-form.json'), '--registry', path.join(realTempDir, 'registry.json'), '--yes'],
        { cwd: realTempDir }
      )

      expect(result.exitCode).toBe(0)

      // Verify registry was updated
      const content = await fs.readFile(path.join(realTempDir, 'registry.json'), 'utf-8')
      const registry = JSON.parse(content)
      expect(registry.items).toHaveLength(1)
      expect(registry.items[0].name).toBe('my-form')
      expect(registry.items[0].kind).toBe('form')
    })

    it('should fail when registry.json does not exist', async () => {
      await fs.writeFile(
        path.join(tempDir, 'my-form.json'),
        JSON.stringify({
          $schema: PARADOC_SCHEMA_URL,
          kind: 'form',
          name: 'my-form',
          version: '1.0.0',
          title: 'My Form',
          fields: {},
        })
      )

      const result = await executeCliCommand(
        ['registry', 'catalog', 'add', 'my-form.json', '--registry', path.join(tempDir, 'nope.json'), '--yes'],
        { cwd: tempDir }
      )

      expect(result.exitCode).toBe(1)
    })

    it('should fail for artifact outside registry tree', async () => {
      // Create registry.json in a subdirectory
      const subDir = path.join(tempDir, 'sub')
      await fs.mkdir(subDir, { recursive: true })
      await fs.writeFile(
        path.join(subDir, 'registry.json'),
        JSON.stringify({
          $schema: 'https://paradoc.sh/schemas/registry.json',
          name: 'test-registry',
          items: [],
        })
      )

      // Create artifact in parent directory
      await fs.writeFile(
        path.join(tempDir, 'outside.json'),
        JSON.stringify({
          $schema: PARADOC_SCHEMA_URL,
          kind: 'form',
          name: 'outside',
          version: '1.0.0',
          title: 'Outside',
          fields: {},
        })
      )

      const result = await executeCliCommand(
        ['registry', 'catalog', 'add', path.join(tempDir, 'outside.json'), '--registry', path.join(subDir, 'registry.json'), '--yes'],
        { cwd: subDir }
      )

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toMatch(/security|outside|above/i)
    })
  })

  describe('registry catalog remove', () => {
    it('should remove an artifact from registry', async () => {
      await fs.writeFile(
        path.join(tempDir, 'registry.json'),
        JSON.stringify({
          $schema: 'https://paradoc.sh/schemas/registry.json',
          name: 'test-registry',
          items: [
            { name: 'my-form', kind: 'form', version: '1.0.0' },
            { name: 'my-doc', kind: 'document', version: '1.0.0' },
          ],
        })
      )

      const result = await executeCliCommand(
        ['registry', 'catalog', 'remove', 'my-form', '--registry', path.join(tempDir, 'registry.json'), '--yes'],
      )

      expect(result.exitCode).toBe(0)

      const content = await fs.readFile(path.join(tempDir, 'registry.json'), 'utf-8')
      const registry = JSON.parse(content)
      expect(registry.items).toHaveLength(1)
      expect(registry.items[0].name).toBe('my-doc')
    })

    it('should fail for nonexistent artifact name', async () => {
      await fs.writeFile(
        path.join(tempDir, 'registry.json'),
        JSON.stringify({
          $schema: 'https://paradoc.sh/schemas/registry.json',
          name: 'test-registry',
          items: [
            { name: 'my-form', kind: 'form', version: '1.0.0' },
          ],
        })
      )

      const result = await executeCliCommand(
        ['registry', 'catalog', 'remove', 'nope', '--registry', path.join(tempDir, 'registry.json'), '--yes'],
      )

      expect(result.exitCode).toBe(1)
    })
  })

  describe('registry compile', () => {
    it('should compile artifacts with --dry-run', async () => {
      // Create registry with an artifact
      await fs.writeFile(
        path.join(tempDir, 'registry.json'),
        JSON.stringify({
          $schema: 'https://paradoc.sh/schemas/registry.json',
          name: 'test-registry',
          items: [
            { name: 'my-form', kind: 'form', version: '1.0.0' },
          ],
        })
      )

      // Create the artifact file
      await fs.writeFile(
        path.join(tempDir, 'my-form.json'),
        JSON.stringify({
          $schema: PARADOC_SCHEMA_URL,
          kind: 'form',
          name: 'my-form',
          version: '1.0.0',
          title: 'My Form',
          fields: {
            name: { type: 'text', label: 'Name', required: true },
          },
        })
      )

      const result = await executeCliCommand(
        ['registry', 'compile', '--registry', path.join(tempDir, 'registry.json'), '--dry-run'],
      )

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/dry.run|would|compiled/i)
    })

    it('should compile artifacts to output directory', async () => {
      const outDir = path.join(tempDir, 'out')

      await fs.writeFile(
        path.join(tempDir, 'registry.json'),
        JSON.stringify({
          $schema: 'https://paradoc.sh/schemas/registry.json',
          name: 'test-registry',
          items: [
            { name: 'my-form', kind: 'form', version: '1.0.0' },
          ],
        })
      )

      await fs.writeFile(
        path.join(tempDir, 'my-form.json'),
        JSON.stringify({
          $schema: PARADOC_SCHEMA_URL,
          kind: 'form',
          name: 'my-form',
          version: '1.0.0',
          title: 'My Form',
          fields: {
            name: { type: 'text', label: 'Name', required: true },
          },
        })
      )

      const result = await executeCliCommand(
        ['registry', 'compile', '--registry', path.join(tempDir, 'registry.json'), '--output', outDir],
      )

      expect(result.exitCode).toBe(0)

      // Verify compiled file exists
      const files = await fs.readdir(outDir)
      expect(files.length).toBeGreaterThan(0)
    })

    it('should record checksums for a PDF layer and its declared font', async () => {
      const outDir = path.join(tempDir, 'out')
      await fs.writeFile(
        path.join(tempDir, 'registry.json'),
        JSON.stringify({ name: 'test-registry', items: [{ name: 'font-form', kind: 'form', version: '1.0.0' }] }),
      )
      await fs.writeFile(
        path.join(tempDir, 'font-form.json'),
        JSON.stringify({
          $schema: PARADOC_SCHEMA_URL,
          kind: 'form',
          name: 'font-form',
          version: '1.0.0',
          title: 'Font Form',
          fields: { name: { type: 'text', label: 'Name' } },
          layers: {
            pdf: { kind: 'file', mimeType: 'application/pdf', path: 'form.pdf', font: { path: 'fonts/form.ttf' } },
          },
        }),
      )
      await fs.writeFile(path.join(tempDir, 'form.pdf'), 'pdf bytes')
      await fs.mkdir(path.join(tempDir, 'fonts'))
      await fs.writeFile(path.join(tempDir, 'fonts', 'form.ttf'), 'font bytes')

      const result = await executeCliCommand(
        ['registry', 'compile', '--registry', path.join(tempDir, 'registry.json'), '--output', outDir],
      )
      expect(result.exitCode).toBe(0)

      const compiled = JSON.parse(await fs.readFile(path.join(outDir, 'font-form.json'), 'utf8'))
      const digest = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`
      expect(compiled.layers.pdf.checksum).toBe(digest('pdf bytes'))
      expect(compiled.layers.pdf.font).toEqual({ path: 'fonts/form.ttf', checksum: digest('font bytes') })
    })

    it('should report errors for missing artifact files', async () => {
      await fs.writeFile(
        path.join(tempDir, 'registry.json'),
        JSON.stringify({
          $schema: 'https://paradoc.sh/schemas/registry.json',
          name: 'test-registry',
          items: [
            { name: 'missing-form', kind: 'form', version: '1.0.0' },
          ],
        })
      )

      const result = await executeCliCommand(
        ['registry', 'compile', '--registry', path.join(tempDir, 'registry.json'), '--dry-run'],
      )

      // Should still exit 0 but report errors in output
      const output = result.stdout + result.stderr
      expect(output).toMatch(/error|not found|missing/i)
    })
  })

  describe('registry view', () => {
    it('should show help for view subcommand', async () => {
      const result = await executeCliCommand(['registry', 'view', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('artifact')
    })

    it('should fail for invalid artifact reference', async () => {
      const result = await executeCliCommand(['registry', 'view', 'invalid-ref'])

      expect(result.exitCode).toBe(1)
    })
  })

  describe('registry info', () => {
    it('should show help for info subcommand', async () => {
      const result = await executeCliCommand(['registry', 'info', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('namespace')
    })
  })
})
