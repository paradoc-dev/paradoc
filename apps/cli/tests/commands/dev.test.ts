/**
 * `para dev` at the command line, and the pieces of its server that can be
 * tested without one.
 *
 * The conventions themselves belong to `@paradoc/react/discovery` and are
 * tested there. What is tested here is the command around them: that it is
 * registered, that `--list` reports what the conventions found, that the
 * toolchain it borrows is reported rather than crashed into, and that the two
 * pieces which decide what the browser may read and what Tailwind may scan do
 * what they claim.
 *
 * The fixtures are directories in this package rather than temporary ones,
 * because discovery is loaded from the project being previewed and a directory
 * in `/tmp` has no `@paradoc/react` above it.
 */

import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { stylesheetModule } from '../../src/commands/dev/harness.js'
import {
  assertUsableReactPackage,
  MissingDevPeerError,
  missingDevPeers,
  UnusableReactPackageError,
} from '../../src/commands/dev/peers.js'
import { servableRoots } from '../../src/commands/dev/server.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.resolve(__dirname, '../fixtures/dev')
const REACT_PACKAGE = path.resolve(__dirname, '../../../../packages/react')

async function executeCliCommand(
  args: string[],
  options?: { cwd?: string; timeout?: number }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const cliPath = path.resolve(__dirname, '../../src/index.ts')
    const child = spawn('tsx', [cliPath, ...args], {
      cwd: options?.cwd ?? process.cwd(),
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`Command timed out after ${options?.timeout ?? 60000}ms`))
    }, options?.timeout ?? 60000)

    child.stdout.on('data', (data) => {
      stdout += String(data)
    })
    child.stderr.on('data', (data) => {
      stderr += String(data)
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

describe('CLI dev command', () => {
  it('is listed among the commands', async () => {
    const result = await executeCliCommand(['--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Preview compositions live with their sample data and a proof PDF')
  })

  it('documents what it previews', async () => {
    const result = await executeCliCommand(['dev', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('--port')
    expect(result.stdout).toContain('--list')
    expect(result.stdout).toContain('proof')
  })

  it('lists each composition with its artifact and its sample', async () => {
    const result = await executeCliCommand(['dev', path.join(FIXTURES, 'paired'), '--list'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain(
      'compositions/change-order.tsx → compositions/change-order.json (sibling) · sample export'
    )
    expect(result.stdout).toContain(
      'compositions/purchase-order.tsx → purchase-order.json#composition · compositions/purchase-order.sample.ts'
    )
  })

  it('reports the pairing as JSON', async () => {
    const result = await executeCliCommand([
      'dev',
      path.join(FIXTURES, 'paired'),
      '--list',
      '--json',
    ])

    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual([
      {
        id: 'compositions/change-order',
        composition: 'compositions/change-order.tsx',
        artifact: {
          file: 'compositions/change-order.json',
          name: 'change-order',
          layer: null,
          matched_by: 'sibling',
        },
        sample: { from: 'composition', file: 'compositions/change-order.tsx' },
        problems: [],
      },
      {
        id: 'compositions/purchase-order',
        composition: 'compositions/purchase-order.tsx',
        artifact: {
          file: 'purchase-order.json',
          name: 'purchase-order',
          layer: 'composition',
          matched_by: 'layer',
        },
        sample: {
          from: 'sibling',
          file: 'compositions/purchase-order.sample.ts',
        },
        problems: [],
      },
    ])
  })

  it('names the rules when a composition has no artifact', async () => {
    const result = await executeCliCommand(['dev', path.join(FIXTURES, 'orphan'), '--list'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('compositions/orphan.tsx → no artifact')
    expect(result.stdout).toContain('text/tsx')
  })

  it('answers a project with no compositions rather than failing', async () => {
    const result = await executeCliCommand(['dev', path.join(FIXTURES, 'empty'), '--list', '--json'])

    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual([])
  })

  it('refuses a port that is not one, before it reads the project', async () => {
    const result = await executeCliCommand([
      'dev',
      path.join(FIXTURES, 'paired'),
      '--port',
      'later',
    ])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('--port must be a port number')
  })
})

describe('the toolchain para dev borrows', () => {
  let scratch: string

  beforeEach(async () => {
    scratch = await fs.mkdtemp(path.join(tmpdir(), 'paradoc-dev-peers-'))
  })

  afterEach(async () => {
    await fs.rm(scratch, { recursive: true, force: true })
  })

  // Resolution itself is not asserted from inside Vitest: it sets NODE_PATH to
  // pnpm's virtual store, which makes every package resolvable from any
  // directory, so a "this project has nothing" test would pass whatever the
  // code did. What is asserted here is that resolution finds the seven where
  // they are installed, and everything about the error a project without them
  // is shown.
  it('finds every peer in a project that has them', () => {
    expect(missingDevPeers(path.resolve(__dirname, '../..'))).toEqual([])
  })

  it('splits runtime packages from development ones', () => {
    const error = new MissingDevPeerError(
      ['vite', '@vitejs/plugin-react', '@paradoc/react', 'react'],
      scratch
    )

    expect(error.message).toContain('npm install --save-dev vite @vitejs/plugin-react')
    expect(error.message).toContain('npm install @paradoc/react react')
    expect(error.message).toContain(scratch)
  })

  it('spells the install for whichever package manager left a lockfile', async () => {
    const npm = new MissingDevPeerError(['vite', 'react'], scratch)
    await fs.writeFile(path.join(scratch, 'yarn.lock'), '', 'utf8')
    const yarn = new MissingDevPeerError(['vite', 'react'], scratch)
    await fs.writeFile(path.join(scratch, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n", 'utf8')
    const pnpm = new MissingDevPeerError(['vite', 'react'], scratch)

    expect(npm.message).toContain('npm install --save-dev vite')
    expect(npm.message).toContain('npm install react')
    expect(yarn.message).toContain('yarn add -D vite')
    expect(yarn.message).toContain('yarn add react')
    // The first lockfile in the list wins, so a project with both reads as pnpm.
    expect(pnpm.message).toContain('pnpm add -D vite')
    expect(pnpm.message).toContain('pnpm add react')
  })

  it('names only what is missing, and only once', () => {
    const one = new MissingDevPeerError(['react'], scratch)

    expect(one.message).toContain('para dev needs react, and it is not installed')
    expect(one.message).not.toContain('--save-dev')
    expect(one.peers).toEqual(['react'])
  })
})

describe('the @paradoc/react a preview styles against', () => {
  let scratch: string

  beforeEach(async () => {
    scratch = await fs.mkdtemp(path.join(tmpdir(), 'paradoc-dev-package-'))
  })

  afterEach(async () => {
    await fs.rm(scratch, { recursive: true, force: true })
  })

  it('accepts the real package', () => {
    expect(() => assertUsableReactPackage(REACT_PACKAGE)).not.toThrow()
  })

  it('refuses a directory that is not a package', () => {
    expect(() => assertUsableReactPackage(scratch)).toThrow(UnusableReactPackageError)
    expect(() => assertUsableReactPackage(scratch)).toThrow(/no package.json/)
  })

  it('refuses a package that is not @paradoc/react', async () => {
    await fs.writeFile(path.join(scratch, 'package.json'), '{"name":"@acme/other"}', 'utf8')

    expect(() => assertUsableReactPackage(scratch)).toThrow(/names @acme\/other/)
  })

  it('refuses the right package with no components to scan', async () => {
    await fs.writeFile(path.join(scratch, 'package.json'), '{"name":"@paradoc/react"}', 'utf8')

    expect(() => assertUsableReactPackage(scratch)).toThrow(/neither a dist nor a src/)
  })

  it('accepts a published layout, which ships dist and no src', async () => {
    await fs.writeFile(path.join(scratch, 'package.json'), '{"name":"@paradoc/react"}', 'utf8')
    await fs.mkdir(path.join(scratch, 'dist'))

    expect(() => assertUsableReactPackage(scratch)).not.toThrow()
  })
})

describe('what the dev server may read', () => {
  it('allows the project, the document package, and that package’s own installs', () => {
    const roots = servableRoots(path.join(FIXTURES, 'paired'), REACT_PACKAGE)

    expect(roots).toContain(path.join(FIXTURES, 'paired'))
    expect(roots).toContain(REACT_PACKAGE)
    expect(roots.some((root) => root.includes('inter'))).toBe(false)
  })

  it('never walks up to a bare ancestor of either', () => {
    const roots = servableRoots(path.join(FIXTURES, 'paired'), REACT_PACKAGE)

    for (const forbidden of [path.dirname(REACT_PACKAGE), path.resolve('/'), path.resolve('/Users')]) {
      expect(roots).not.toContain(forbidden)
    }
    // Every entry is the project, the package, or something installed under one
    // of them — never a directory that merely contains a node_modules.
    for (const root of roots) {
      expect(root.split(path.sep).length).toBeGreaterThan(2)
    }
  })

  it('reports nothing extra for a package with no dependencies installed', () => {
    const roots = servableRoots(path.join(FIXTURES, 'paired'), path.join(FIXTURES, 'empty'))

    expect(roots).toEqual([path.join(FIXTURES, 'paired'), path.join(FIXTURES, 'empty')])
  })
})

describe('the stylesheet the preview compiles', () => {
  it('scans the project and both layouts of the document package', () => {
    const css = stylesheetModule('/project', '/project/node_modules/@paradoc/react', [
      'node_modules',
      'dist',
    ])

    expect(css).toContain('@source "**/*.{tsx,jsx}"')
    expect(css).toContain('@source not "node_modules"')
    expect(css).toContain('@source not "dist"')
    expect(css).toContain('@source "node_modules/@paradoc/react/dist/**/*.js"')
    expect(css).toContain('@source "node_modules/@paradoc/react/src/**/*.{ts,tsx}"')
  })

  it('reaches a linked package outside the project', () => {
    const css = stylesheetModule('/work/project', '/work/packages/react', ['node_modules'])

    expect(css).toContain('@source "../packages/react/dist/**/*.js"')
    expect(css).toContain('@source "../packages/react/src/**/*.{ts,tsx}"')
  })

  it('imports the document stylesheet before Tailwind, so the font faces survive', () => {
    const css = stylesheetModule('/project', '/project/node_modules/@paradoc/react', [])

    expect(css.indexOf('@import "@paradoc/react/styles.css"')).toBeLessThan(
      css.indexOf('@import "tailwindcss"')
    )
  })
})
