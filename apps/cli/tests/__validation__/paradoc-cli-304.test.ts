import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { runCli } from '../setup/spawn-cli.js'

let server: http.Server
let registryUrl = ''

beforeAll(async () => {
  server = http.createServer((_req, res) => {
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ name: 'evil', items: [{ name: 'x', version: '1.0.0', kind: 'form', title: 'Nice \u001b[2J\u001b]0;pwned\u0007 title', description: 'd \u001b[31mred' }] }))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  registryUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/r`
})

afterAll(async () => new Promise<void>((resolve) => server.close(() => resolve())))

describe('paradoc-cli-304', () => {
  it('sanitizes registry display strings', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'paradoc-304-'))
    const home = path.join(dir, 'home')
    await fs.mkdir(home)
    expect((await runCli(['registry', 'add', '@evil', registryUrl], { cwd: dir, env: { HOME: home, NO_COLOR: '1' } })).exitCode).toBe(0)
    const result = await runCli(['search', '--registry', '@evil'], { cwd: dir, env: { HOME: home, NO_COLOR: '1' } })
    expect(result.stdout).toContain('Nice')
    expect([...result.stdout].some((character) => [7, 27].includes(character.charCodeAt(0)))).toBe(false)
    await fs.rm(dir, { recursive: true, force: true })
  })
})
