import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { createFsResolver } from '@paradoc/resolvers/fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const fixturesDir = path.resolve(__dirname, '../fixtures')
const execFileAsync = promisify(execFile)

beforeAll(async () => {
  await execFileAsync('pnpm', ['run', 'build'], {
    cwd: path.resolve(__dirname, '../..'),
  })
})

async function executeCliCommand(
  args: string[],
  options?: {
    cwd?: string
    env?: Record<string, string>
    timeout?: number
    stdin?: string
    built?: boolean
  }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const cliPath = path.resolve(__dirname, options?.built ? '../../dist/index.js' : '../../src/index.ts')
    const executable = options?.built ? process.execPath : 'tsx'
    const child = spawn(executable, [cliPath, ...args], {
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
      resolve({ stdout, stderr, exitCode: code ?? 0 })
    })

    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })

    child.stdin.end(options?.stdin)
  })
}

describe('CLI render command', () => {
  const fixture = path.join(fixturesDir, 'pet-addendum.yaml')

  it('should show help', async () => {
    const result = await executeCliCommand(['render', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('--out')
    expect(result.stdout).toContain('--layer')
    expect(result.stdout).toContain('--format')
    expect(result.stdout).toContain('--data')
    expect(result.stdout).toContain('--dry-run')
    expect(result.stdout).not.toContain('--renderer')
  })

  it('should render an inline layer to stdout', async () => {
    const result = await executeCliCommand(['render', fixture])

    expect(result.exitCode).toBe(0)
    // The pet-addendum has an inline markdown layer
    expect(result.stdout.length).toBeGreaterThan(0)
  })

  it('should support dry-run', async () => {
    const result = await executeCliCommand(['render', fixture, '--dry-run'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Dry run')
    expect(result.stdout).toContain('pet-addendum')
  })

  it('should support dry-run with --format json', async () => {
    const result = await executeCliCommand(['render', fixture, '--dry-run', '--format', 'json'])

    expect(result.exitCode).toBe(0)
    const json = JSON.parse(result.stdout)
    expect(json.mode).toBe('dry-run')
    expect(json.artifact.name).toBe('pet-addendum')
  })

  it('should fail for non-existent file', async () => {
    const result = await executeCliCommand(['render', '/tmp/nonexistent.yaml'])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Error')
  })

  describe('render with data', () => {
    let tempDir: string

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paradoc-render-test-'))
    })

    afterEach(async () => {
      try {
        await fs.rm(tempDir, { recursive: true, force: true })
      } catch {
        // Ignore
      }
    })

    it('should render with inline JSON data', async () => {
      const data = JSON.stringify({
        fields: {
          name: 'Rex',
          species: 'dog',
          weight: 30,
          hasVaccination: true,
        }
      })

      const result = await executeCliCommand(['render', fixture, '--data', data])

      expect(result.exitCode).toBe(0)
      // The rendered output should contain the substituted values
      expect(result.stdout).toContain('Rex')
    })

    it('should render with data from file', async () => {
      const dataPath = path.join(tempDir, 'data.json')
      await fs.writeFile(dataPath, JSON.stringify({
        fields: {
          name: 'Luna',
          species: 'cat',
          weight: 5,
          hasVaccination: false,
        }
      }))

      const result = await executeCliCommand(['render', fixture, '--data', dataPath])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Luna')
    })

    it.each([
      ['PDF', 'pet-addendum-pdf.yaml', 'output.pdf', '%PDF'],
      ['DOCX', 'pet-addendum-docx.yaml', 'output.docx', 'PK'],
    ])('should select the %s renderer from the layer MIME type', async (_format, fixtureName, outputName, signature) => {
      const outPath = path.join(tempDir, outputName)
      const data = JSON.stringify({
        fields: {
          name: 'Milo',
          species: 'cat',
          weight: 5,
          hasVaccination: true,
        },
      })

      const result = await executeCliCommand([
        'render',
        path.join(fixturesDir, fixtureName),
        '--data',
        data,
        '--out',
        outPath,
      ])

      expect(result.exitCode).toBe(0)
      const content = await fs.readFile(outPath)
      expect(content.subarray(0, signature.length).toString()).toBe(signature)
    })

    it('should write output to file with --out', async () => {
      const outPath = path.join(tempDir, 'output.md')

      const result = await executeCliCommand(['render', fixture, '--out', outPath])

      expect(result.exitCode).toBe(0)

      const content = await fs.readFile(outPath, 'utf-8')
      expect(content).toContain('Pet Addendum')
    })

    it('should specify layer with --layer', async () => {
      // pet-addendum.yaml has a 'default' layer
      const result = await executeCliCommand(['render', fixture, '--layer', 'default'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout.length).toBeGreaterThan(0)
    })

    it('should fail for nonexistent layer', async () => {
      const result = await executeCliCommand(['render', fixture, '--layer', 'nonexistent'])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toMatch(/not found|error/i)
    })
  })

  describe('file-layer resolution', () => {
    let sandbox: string
    let artifactDir: string
    let outsideDir: string

    beforeEach(async () => {
      sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'paradoc-cli-resolver-'))
      artifactDir = path.join(sandbox, 'artifacts', 'nested')
      outsideDir = path.join(sandbox, 'outside')
      await Promise.all([
        fs.mkdir(path.join(artifactDir, 'templates'), { recursive: true }),
        fs.mkdir(outsideDir, { recursive: true }),
      ])
      await Promise.all([
        fs.writeFile(path.join(artifactDir, 'templates', 'layer.md'), 'inside layer'),
        fs.writeFile(path.join(artifactDir, '..valid.md'), 'dot-prefixed layer'),
        fs.writeFile(path.join(outsideDir, 'sentinel.md'), 'outside sentinel'),
      ])
    })

    afterEach(async () => {
      await fs.rm(sandbox, { recursive: true, force: true })
    })

    async function writeArtifact(layerPath: string): Promise<string> {
      const artifactPath = path.join(artifactDir, 'artifact.json')
      await fs.writeFile(artifactPath, JSON.stringify({
        kind: 'document',
        name: 'resolver-test',
        version: '1.0.0',
        title: 'Resolver Test',
        description: 'Exercises CLI file-layer resolution.',
        defaultLayer: 'default',
        layers: {
          default: { kind: 'file', mimeType: 'text/markdown', path: layerPath },
        },
      }))
      return artifactPath
    }

    it.each(['templates/layer.md', '/templates/layer.md'])(
      'resolves %s inside the artifact directory from another cwd',
      async (layerPath) => {
        const artifactPath = await writeArtifact(layerPath)
        const result = await executeCliCommand(['render', artifactPath], { cwd: outsideDir })
        const resolverBytes = await createFsResolver({ root: artifactDir }).read(layerPath)
        expect(result).toMatchObject({ exitCode: 0, stdout: 'inside layer' })
        expect(result.stdout).toBe(new TextDecoder().decode(resolverBytes))
      },
    )

    it('resolves artifact-relative layers through the built package executable', async () => {
      const artifactPath = await writeArtifact('templates/layer.md')
      const result = await executeCliCommand(['render', artifactPath], {
        built: true,
        cwd: outsideDir,
      })
      expect(result).toMatchObject({ exitCode: 0, stdout: 'inside layer' })
    })

    it('uses cwd as the resolver root for stdin artifacts', async () => {
      await fs.writeFile(path.join(outsideDir, 'stdin.md'), 'stdin layer')
      const artifactPath = await writeArtifact('/stdin.md')
      const raw = await fs.readFile(artifactPath, 'utf8')
      const result = await executeCliCommand(['render', '-'], { cwd: outsideDir, stdin: raw })
      expect(result).toMatchObject({ exitCode: 0, stdout: 'stdin layer' })
    })

    it('renders valid dot-prefixed paths', async () => {
      const artifactPath = await writeArtifact('..valid.md')
      const result = await executeCliCommand(['render', artifactPath])
      expect(result).toMatchObject({ exitCode: 0, stdout: 'dot-prefixed layer' })
    })

    it.each([
      '../outside/sentinel.md',
      '/tmp/outside/sentinel.md',
      'C:/outside/sentinel.md',
      'outside\\sentinel.md',
    ])('rejects escape path %s without emitting outside bytes', async (layerPath) => {
      const artifactPath = await writeArtifact(layerPath)
      const result = await executeCliCommand(['render', artifactPath])
      expect(result.exitCode).toBe(1)
      expect(result.stdout).not.toContain('outside sentinel')
      expect(result.stderr).toContain('Error:')
    })

    it('rejects outward file and directory symlinks', async () => {
      await fs.symlink(path.join(outsideDir, 'sentinel.md'), path.join(artifactDir, 'outside-file'))
      await fs.symlink(outsideDir, path.join(artifactDir, 'outside-dir'))

      for (const layerPath of ['outside-file', 'outside-dir/sentinel.md']) {
        const artifactPath = await writeArtifact(layerPath)
        const result = await executeCliCommand(['render', artifactPath])
        expect(result.exitCode).toBe(1)
        expect(result.stdout).not.toContain('outside sentinel')
        expect(result.stderr).toContain('outside the configured root')
      }
    })

    it('renders the artifact-relative path produced by attach from another cwd', async () => {
      const artifactPath = await writeArtifact('templates/layer.md')
      const attachedPath = path.join(artifactDir, 'attached.md')
      await fs.writeFile(attachedPath, 'attached layer')
      const attached = await executeCliCommand([
        'attach', artifactPath, attachedPath, '--yes', '--name', 'attached',
      ], { cwd: outsideDir })
      expect(attached.exitCode).toBe(0)

      const rendered = await executeCliCommand([
        'render', artifactPath, '--layer', 'attached',
      ], { cwd: outsideDir })
      expect(rendered).toMatchObject({ exitCode: 0, stdout: 'attached layer' })
    })
  })
})
