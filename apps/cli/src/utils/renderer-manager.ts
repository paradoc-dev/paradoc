import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promises as fs } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import ora from 'ora'

const execFileAsync = promisify(execFile)

declare const __RENDERER_VERSIONS__: Record<string, string> | undefined

/** Renderer package versions, injected at build time via tsup define */
const RENDERER_VERSIONS: Record<string, string> =
  typeof __RENDERER_VERSIONS__ !== 'undefined'
    ? __RENDERER_VERSIONS__
    : {
        '@paradoc/renderer-text': '0.2.1',
        '@paradoc/renderer-pdf': '0.2.1',
        '@paradoc/renderer-docx': '0.2.1',
      }

/** Peer deps installed as regular deps in the isolated renderer directories */
const PEER_DEPS: Record<string, string> = {
  '@paradoc/types': '0.2.1',
  '@paradoc/serialization': '0.2.1',
}

const RENDERERS_DIR = join(homedir(), '.paradoc', 'renderers')

export interface RendererStatus {
  name: string
  expectedVersion: string
  installedVersion: string | null
  installed: boolean
  size: number | null
}

class RendererManager {
  private getRendererDir(pkg: string): string {
    // @paradoc/renderer-text -> @paradoc+renderer-text
    return join(RENDERERS_DIR, pkg.replace('/', '+'))
  }

  /** Ensure a renderer is installed and at the correct version. Returns its base dir. */
  async ensureRenderer(pkg: string): Promise<string> {
    const dir = this.getRendererDir(pkg)
    const pkgJsonPath = join(dir, 'node_modules', pkg, 'package.json')

    try {
      const content = await fs.readFile(pkgJsonPath, 'utf-8')
      const parsed = JSON.parse(content)
      const expected = RENDERER_VERSIONS[pkg]
      if (parsed.version === expected) {
        return dir
      }
    } catch {
      // Not installed or can't read — will install below
    }

    await this.installRenderer(pkg)
    return dir
  }

  /** Dynamically load a renderer module and return it */
  async loadModule(pkg: string): Promise<Record<string, unknown>> {
    // In a workspace (dev), the renderer resolves via pnpm linking
    try {
      return await import(pkg)
    } catch {
      // Published CLI — install into isolated directory
      const dir = await this.ensureRenderer(pkg)
      const entryPath = join(dir, 'node_modules', pkg, 'dist', 'index.js')
      return await import(pathToFileURL(entryPath).href)
    }
  }

  /** Install a renderer into its isolated directory */
  async installRenderer(pkg: string): Promise<void> {
    const version = RENDERER_VERSIONS[pkg]
    if (!version) {
      throw new Error(`Unknown renderer package: ${pkg}`)
    }

    const spinner = ora(`Installing ${pkg}@${version}...`).start()

    try {
      const dir = this.getRendererDir(pkg)
      await fs.mkdir(dir, { recursive: true })

      // Write a minimal package.json with the renderer + peer deps as regular deps
      const pkgJson = {
        name: `paradoc-plugin-${pkg.split('/').pop()}`,
        version: '1.0.0',
        private: true,
        dependencies: {
          [pkg]: version,
          ...PEER_DEPS,
        },
      }

      await fs.writeFile(join(dir, 'package.json'), JSON.stringify(pkgJson, null, 2))

      // npm is always available with Node.js
      await execFileAsync('npm', ['install', '--production', '--ignore-scripts'], {
        cwd: dir,
        env: { ...process.env, NODE_ENV: 'production' },
      })

      spinner.succeed(`Installed ${pkg}@${version}`)
    } catch (error) {
      spinner.fail(`Failed to install ${pkg}`)
      throw error
    }
  }

  /** Install all known renderers */
  async installAll(): Promise<void> {
    for (const pkg of Object.keys(RENDERER_VERSIONS)) {
      await this.installRenderer(pkg)
    }
  }

  /** Remove a single renderer */
  async removeRenderer(pkg: string): Promise<void> {
    const dir = this.getRendererDir(pkg)
    await fs.rm(dir, { recursive: true, force: true })
  }

  /** Remove all installed renderers */
  async removeAll(): Promise<void> {
    await fs.rm(RENDERERS_DIR, { recursive: true, force: true })
  }

  /** Get installation status of all renderers */
  async status(): Promise<RendererStatus[]> {
    const results: RendererStatus[] = []

    for (const [pkg, expectedVersion] of Object.entries(RENDERER_VERSIONS)) {
      const dir = this.getRendererDir(pkg)
      const pkgJsonPath = join(dir, 'node_modules', pkg, 'package.json')

      let installedVersion: string | null = null
      let size: number | null = null

      try {
        const content = await fs.readFile(pkgJsonPath, 'utf-8')
        const parsed = JSON.parse(content)
        installedVersion = parsed.version
        size = await this.getDirectorySize(dir)
      } catch {
        // Not installed
      }

      results.push({
        name: pkg,
        expectedVersion,
        installedVersion,
        installed: installedVersion !== null,
        size,
      })
    }

    return results
  }

  /** Get the known renderer package names and their expected versions */
  getRendererPackages(): Record<string, string> {
    return { ...RENDERER_VERSIONS }
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      for (const entry of entries) {
        const entryPath = join(dirPath, entry.name)
        if (entry.isDirectory()) {
          totalSize += await this.getDirectorySize(entryPath)
        } else {
          const stat = await fs.stat(entryPath)
          totalSize += stat.size
        }
      }
    } catch {
      // Directory doesn't exist or can't read
    }
    return totalSize
  }
}

export const rendererManager = new RendererManager()
