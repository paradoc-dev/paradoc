import { runCli } from '../setup/spawn-cli'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveRendererName } from '../../src/commands/renderers'
import { rendererManager, resolveInstalledEntry } from '../../src/utils/renderer-manager'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let tempHome = ''

beforeAll(async () => {
  tempHome = await mkdtemp(path.join(tmpdir(), 'paradoc-renderers-home-'))
})

afterAll(async () => {
  await rm(tempHome, { recursive: true, force: true })
})

function executeCliCommand(args: string[], options: Parameters<typeof runCli>[1] = {}) {
  return runCli(args, {
    ...options,
    env: {
      HOME: tempHome,
      USERPROFILE: tempHome,
      XDG_CONFIG_HOME: path.join(tempHome, '.config'),
      ...options.env,
    },
  })
}

describe('CLI renderers command', () => {
  it('keeps isolated renderer packages on the release version', () => {
    expect(rendererManager.getRendererPackages()).toEqual({
      '@paradoc/render': '0.5.0',
      '@paradoc/react': '0.5.0',
      '@paradoc/react-pdf': '0.5.0',
    })
    expect(rendererManager.getRendererPeerDependencies()).toEqual({
      '@paradoc/render': {
        '@paradoc/types': '0.5.0',
        '@paradoc/format': '0.5.0',
      },
      '@paradoc/react': {
        react: '19.2.3',
        'react-dom': '19.2.3',
      },
      '@paradoc/react-pdf': {
        react: '19.2.3',
        'react-dom': '19.2.3',
      },
    })
  })

  describe('resolveInstalledEntry', () => {
    let dir = ''

    beforeAll(async () => {
      // Real, because resolution answers with the real path and macOS links /var.
      dir = await realpath(await mkdtemp(path.join(tmpdir(), 'paradoc-renderer-dir-')))
      const pkg = path.join(dir, 'node_modules', '@paradoc', 'react-pdf')
      await mkdir(path.join(pkg, 'dist'), { recursive: true })
      await writeFile(
        path.join(pkg, 'package.json'),
        JSON.stringify({
          name: '@paradoc/react-pdf',
          type: 'module',
          exports: {
            '.': { import: './dist/index.js', default: './dist/index.js' },
            './check': { import: './dist/check.js', default: './dist/check.js' },
          },
        })
      )
      await writeFile(path.join(pkg, 'dist', 'index.js'), 'export {}\n')
      await writeFile(path.join(pkg, 'dist', 'check.js'), 'export {}\n')
    })

    afterAll(async () => {
      await rm(dir, { recursive: true, force: true })
    })

    it('reads the entry an installed package exports for the root and a subpath', () => {
      const pkg = path.join(dir, 'node_modules', '@paradoc', 'react-pdf')
      expect(resolveInstalledEntry(dir, '@paradoc/react-pdf')).toBe(path.join(pkg, 'dist', 'index.js'))
      expect(resolveInstalledEntry(dir, '@paradoc/react-pdf/check')).toBe(path.join(pkg, 'dist', 'check.js'))
    })

    it('refuses a subpath the installed package does not export', () => {
      expect(() => resolveInstalledEntry(dir, '@paradoc/react-pdf/chromium')).toThrow(/not defined by "exports"/)
    })

    // A nested entry is where guessing `dist/<subpath>.js` went wrong.
    it('reaches a nested entry such as @paradoc/react/discovery', () => {
      const cli = path.resolve(__dirname, '../..')
      expect(resolveInstalledEntry(cli, '@paradoc/react/discovery')).toMatch(/dist[\\/]discovery[\\/]index\.js$/)
    })
  })

  describe('resolveRendererName', () => {
    const packages = { '@paradoc/render': '0.5.0', '@paradoc/react': '0.5.0', '@paradoc/react-pdf': '0.5.0' }

    it.each([
      ['render', '@paradoc/render'],
      ['react', '@paradoc/react'],
      ['@paradoc/render', '@paradoc/render'],
      ['@paradoc/react', '@paradoc/react'],
      ['text', '@paradoc/render'],
      ['pdf', '@paradoc/render'],
      ['docx', '@paradoc/render'],
      ['@paradoc/render/pdf', '@paradoc/render'],
      ['react-pdf', '@paradoc/react-pdf'],
      ['@paradoc/react-pdf', '@paradoc/react-pdf'],
      ['@paradoc/react-pdf/check', '@paradoc/react-pdf'],
      ['@paradoc/react/discovery', '@paradoc/react'],
    ])('resolves %s to %s', (name, expected) => {
      expect(resolveRendererName(name, packages)).toBe(expected)
    })

    it('rejects an unknown name and lists every name it accepts', () => {
      expect(() => resolveRendererName('nonexistent', packages)).toThrow(
        'Unknown renderer "nonexistent". Available: render, react, react-pdf, text, pdf, docx',
      )
    })

    it.each(['rend', '@paradoc/renderer', '@paradoc', 'paradoc/render'])('rejects %s, which only resembles a package', (name) => {
      expect(() => resolveRendererName(name, packages)).toThrow(`Unknown renderer "${name}"`)
    })
  })

  describe('help', () => {
    it('should list all sub-commands', async () => {
      const result = await executeCliCommand(['renderers', '--help'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('status')
      expect(result.stdout).toContain('install')
      expect(result.stdout).toContain('remove')
      expect(result.stdout).toContain('update')
    })
  })

  describe('status', () => {
    it('should output valid JSON with --json', async () => {
      const result = await executeCliCommand(['renderers', 'status', '--json'])

      expect(result.exitCode).toBe(0)
      const json = JSON.parse(result.stdout)
      expect(Array.isArray(json)).toBe(true)
      for (const entry of json) {
        expect(entry).toHaveProperty('name')
        expect(entry).toHaveProperty('expectedVersion')
        expect(entry).toHaveProperty('installed')
      }
    })

    it('should show human-readable output', async () => {
      const result = await executeCliCommand(['renderers', 'status'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Renderer plugins')
    })
  })

  describe('remove', () => {
    it('should remove all renderers when called without arguments', async () => {
      const result = await executeCliCommand(['renderers', 'remove'])

      expect(result.exitCode).toBe(0)
      const output = result.stdout + result.stderr
      expect(output).toContain('Removed all renderers')
    })
  })

  describe('install', () => {
    it('should fail for an unknown renderer name', async () => {
      const result = await executeCliCommand(['renderers', 'install', 'nonexistent'])

      expect(result.exitCode).toBe(1)
      const output = result.stdout + result.stderr
      expect(output).toContain('Unknown renderer')
    })
  })
})
