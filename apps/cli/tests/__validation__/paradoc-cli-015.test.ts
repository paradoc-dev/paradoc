/**
 * Validation repro for paradoc-cli-015: registry items served as YAML fail to parse.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'node:child_process'
import http from 'node:http'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AddressInfo } from 'node:net'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLI = path.resolve(__dirname, '../../dist/index.js')
const SCRATCH = '/tmp/paradoc-cli-015'

const ITEM_YAML = `$schema: https://schema.paradoc.dev/2026-09-24.json
name: lease
kind: document
version: 1.0.0
title: Lease
`

let server: http.Server
let url = ''

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/registry.json') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({
        name: 'val',
        items: [{ name: 'lease', kind: 'document', version: '1.0.0', title: 'Lease', path: 'artifacts/lease/artifact.yaml' }],
      }))
      return
    }
    if (req.url === '/artifacts/lease/artifact.yaml') {
      res.writeHead(200, { 'content-type': 'application/yaml' })
      res.end(ITEM_YAML)
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

describe('paradoc-cli-015', () => {
  it('add installs an item the registry serves as application/yaml', async () => {
    mkdirSync(SCRATCH, { recursive: true })
    const home = mkdtempSync(path.join(SCRATCH, 'home-015-'))
    const cwd = mkdtempSync(path.join(SCRATCH, 'cwd-015-'))
    mkdirSync(path.join(home, '.paradoc'), { recursive: true })
    writeFileSync(path.join(home, '.paradoc', 'config.json'), JSON.stringify({ registries: { '@val': url } }))

    mkdirSync(path.join(cwd, '.paradoc'), { recursive: true })
    writeFileSync(path.join(cwd, 'paradoc.json'), JSON.stringify({
      $schema: 'https://schema.paradoc.dev/manifest.json',
      name: '@test/test-project',
      title: 'Test Project',
      visibility: 'private',
    }))

    const r = await run(['add', '@val/lease'], home, cwd)
    expect(r.out).not.toMatch(/Unexpected token|is not valid JSON|SyntaxError/)
    expect(r.code, r.out).toBe(0)
  })
})
