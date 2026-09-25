/**
 * Validation repro for paradoc-cli-016: requested layers that are missing or
 * unchecksummed are skipped and the install still exits 0.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'node:child_process'
import http from 'node:http'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AddressInfo } from 'node:net'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLI = path.resolve(__dirname, '../../dist/index.js')
const SCRATCH = '/tmp/paradoc-cli-016'

const ITEM = {
  $schema: 'https://schema.paradoc.dev/2026-09-24.json',
  name: 'lease',
  kind: 'document',
  version: '1.0.0',
  title: 'Lease',
  layers: {
    // file layer with no checksum
    doc: { kind: 'file', path: 'lease.md', mimeType: 'text/markdown' },
  },
}

let server: http.Server
let url = ''

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/registry.json') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({
        name: 'val',
        items: [{ name: 'lease', kind: 'document', version: '1.0.0', title: 'Lease', path: 'artifacts/lease/artifact.json' }],
      }))
      return
    }
    if (req.url === '/artifacts/lease/artifact.json') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(ITEM))
      return
    }
    if (req.url === '/artifacts/lease/lease.md') {
      res.writeHead(200, { 'content-type': 'text/markdown' })
      res.end('# Lease')
      return
    }
    res.writeHead(404)
    res.end()
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  url = `http://localhost:${(server.address() as AddressInfo).port}`
})
afterAll(() => new Promise<void>((r) => server.close(() => r())))

function run(args: string[], home: string, cwd: string): Promise<{ out: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd,
      env: { ...process.env, HOME: home, USERPROFILE: home, DO_NOT_TRACK: '1', CI: '1', NO_COLOR: '1' },
    })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    child.on('close', (code) => resolve({ out, code: code ?? 0 }))
  })
}

function project() {
  mkdirSync(SCRATCH, { recursive: true })
  const home = mkdtempSync(path.join(SCRATCH, 'home-016-'))
  const cwd = mkdtempSync(path.join(SCRATCH, 'cwd-016-'))
  mkdirSync(path.join(home, '.paradoc'), { recursive: true })
  writeFileSync(path.join(home, '.paradoc', 'config.json'), JSON.stringify({ registries: { '@val': url } }))
  mkdirSync(path.join(cwd, '.paradoc'), { recursive: true })
  writeFileSync(path.join(cwd, 'paradoc.json'), JSON.stringify({
    $schema: 'https://schema.paradoc.dev/manifest.json',
    name: '@test/test-project',
    title: 'Test Project',
    visibility: 'private',
  }))
  return { home, cwd }
}

describe('paradoc-cli-016', () => {
  it('fails when an explicitly requested layer does not exist', async () => {
    const { home, cwd } = project()
    const r = await run(['add', '@val/lease', '--layers', 'pdf'], home, cwd)
    expect(r.out).toContain('requested layer is not declared by the artifact')
    expect(r.code, r.out).not.toBe(0)
  })

  it('fails when a requested file layer has no checksum (nothing unverified is referenced)', async () => {
    const { home, cwd } = project()
    const r = await run(['add', '@val/lease', '--layers', 'doc'], home, cwd)
    expect(r.out).toContain('missing required checksum')
    expect(r.code, r.out).not.toBe(0)
    // The installed artifact must not reference a file that was never downloaded
    expect(existsSync(path.join(cwd, 'artifacts', '@val', 'lease.md'))).toBe(false)
  })
})
