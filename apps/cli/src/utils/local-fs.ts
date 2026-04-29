// Slimmed-down LocalFileSystem for the CLI (no adm-zip, no mime-types)
import { promises as fs, createReadStream, readFileSync as nodeReadFileSync } from 'node:fs'
import { lstat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import {
  join,
  resolve,
  dirname as pathDirname,
  basename as pathBasename,
  extname as pathExtname,
  relative as pathRelative,
  sep as pathSep,
} from 'node:path'
import fg from 'fast-glob'

export interface FileStats {
  path: string
  name: string
  size: number
  isDirectory: boolean
  isFile: boolean
  mimeType?: string
  createdAt?: Date
  modifiedAt?: Date
}

export class LocalFileSystem {
  private baseDir: string

  constructor(baseDir?: string) {
    this.baseDir = baseDir ? resolve(baseDir) : process.cwd()
  }

  // PATH UTILITIES

  joinPath(...segments: string[]): string {
    const joined = join(...segments)
    return this.resolvePath(joined)
  }

  getAbsolutePath(path: string): string {
    return this.resolvePath(path)
  }

  basename(path: string): string {
    return pathBasename(path)
  }

  dirname(path: string): string {
    return pathDirname(path)
  }

  extname(path: string): string {
    return pathExtname(path)
  }

  relative(from: string, to: string): string {
    const resolvedFrom = this.resolvePath(from)
    const resolvedTo = this.resolvePath(to)
    return pathRelative(resolvedFrom, resolvedTo)
  }

  async glob(
    patterns: string[],
    options?: { onlyFiles?: boolean; ignore?: string[] }
  ): Promise<string[]> {
    const results = await fg(patterns, {
      cwd: this.baseDir,
      onlyFiles: options?.onlyFiles ?? true,
      ignore: options?.ignore,
      absolute: false,
    })
    return results
  }

  async findUp(filename: string, options?: { stopAt?: string }): Promise<string | null> {
    let dir = this.baseDir
    const stop = options?.stopAt ? resolve(options.stopAt) : undefined
    while (true) {
      const filePath = join(dir, filename)
      try {
        await fs.access(filePath)
        return filePath
      } catch {
        // not found, keep walking up
      }
      const parent = pathDirname(dir)
      if (parent === dir || (stop && dir === stop)) return null
      dir = parent
    }
  }

  // READ OPERATIONS

  async readFile(path: string): Promise<string>
  async readFile(path: string, encoding: 'utf-8'): Promise<string>
  async readFile(path: string, encoding: 'binary'): Promise<Buffer>
  async readFile(path: string, encoding: 'utf-8' | 'binary' = 'utf-8'): Promise<string | Buffer> {
    const fullPath = this.resolvePath(path)
    if (encoding === 'binary') {
      return fs.readFile(fullPath)
    }
    return fs.readFile(fullPath, 'utf-8')
  }

  async exists(path: string): Promise<boolean> {
    const fullPath = this.resolvePath(path)
    try {
      await fs.access(fullPath)
      return true
    } catch {
      return false
    }
  }

  async stat(path: string): Promise<FileStats> {
    const fullPath = this.resolvePath(path)
    const stats = await fs.stat(fullPath)
    const name = pathBasename(fullPath)

    return {
      path: fullPath,
      name,
      size: stats.size,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
    }
  }

  async listFiles(path: string): Promise<string[]> {
    const fullPath = this.resolvePath(path)
    const entries = await fs.readdir(fullPath, { withFileTypes: true })
    return entries.map((entry) => entry.name)
  }

  readFileSync(path: string): Buffer
  readFileSync(path: string, encoding: 'utf-8'): string
  readFileSync(path: string, encoding?: 'utf-8'): string | Buffer {
    const fullPath = this.resolvePath(path)
    if (encoding === 'utf-8') {
      return nodeReadFileSync(fullPath, 'utf-8')
    }
    return nodeReadFileSync(fullPath)
  }

  async isSymlink(path: string): Promise<boolean> {
    const fullPath = this.resolvePath(path)
    try {
      const stats = await lstat(fullPath)
      return stats.isSymbolicLink()
    } catch {
      return false
    }
  }

  async computeFileHash(path: string, algorithm: string = 'sha256'): Promise<string> {
    const fullPath = this.resolvePath(path)

    await fs.stat(fullPath)

    return new Promise((resolve, reject) => {
      const hash = createHash(algorithm)
      const stream = createReadStream(fullPath)

      stream.on('data', (chunk) => {
        hash.update(chunk)
      })

      stream.on('end', () => {
        resolve(hash.digest('hex'))
      })

      stream.on('error', (error) => {
        reject(new Error(`Failed to compute hash for ${path}: ${error.message}`))
      })
    })
  }

  // PATH SECURITY UTILITIES

  get separator(): string {
    return pathSep
  }

  resolve(...segments: string[]): string {
    return resolve(...segments)
  }

  // WRITE OPERATIONS

  async writeFile(path: string, content: string | Buffer): Promise<void> {
    const fullPath = this.resolvePath(path)
    await fs.mkdir(pathDirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, content)
  }

  async deleteFile(path: string): Promise<void> {
    const fullPath = this.resolvePath(path)
    await fs.unlink(fullPath)
  }

  async mkdir(path: string, recursive: boolean = true): Promise<void> {
    const fullPath = this.resolvePath(path)
    await fs.mkdir(fullPath, { recursive })
  }

  async deleteDirectory(path: string, recursive: boolean = true): Promise<void> {
    const fullPath = this.resolvePath(path)
    await fs.rm(fullPath, { recursive, force: true })
  }

  private resolvePath(path: string): string {
    if (path.startsWith('/')) {
      return path
    }
    return join(this.baseDir, path)
  }
}
