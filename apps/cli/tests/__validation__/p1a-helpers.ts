// Validation helpers for findings paradoc-cli-001..012 (validator val-p1a). Not a test file.
import { spawn, execFileSync } from 'node:child_process'
import { promises as fs, readFileSync, mkdirSync } from 'node:fs'
import { createServer as createHttpsServer, type Server as HttpsServer } from 'node:https'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const CLI = path.resolve(here, '../../dist/index.js')
export const SCRATCH = path.join(process.env.TMPDIR ?? '/tmp', 'paradoc-cli-p1a')

export interface CliResult { stdout: string; stderr: string; exitCode: number }

export function runCli(args: string[], opts: { cwd: string; home?: string; env?: Record<string, string>; input?: string; timeout?: number }): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const home = opts.home ?? path.join(opts.cwd, '.home')
    mkdirSync(home, { recursive: true })
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd: opts.cwd,
      env: {
        ...process.env,
        HOME: home,
        USERPROFILE: home,
        XDG_CONFIG_HOME: path.join(home, '.config'),
        XDG_CACHE_HOME: path.join(home, '.cache'),
        DO_NOT_TRACK: '1',
        PARADOC_TELEMETRY_DISABLED: '1',
        NO_UPDATE_NOTIFIER: '1',
        CI: '1',
        ...opts.env,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => { child.kill(); reject(new Error(`timeout: ${args.join(' ')}\n${stdout}\n${stderr}`)) }, opts.timeout ?? 30000)
    child.stdout.on('data', (d) => { stdout += d })
    child.stderr.on('data', (d) => { stderr += d })
    child.on('close', (code) => { clearTimeout(timer); resolve({ stdout, stderr, exitCode: code ?? 0 }) })
    child.on('error', (e) => { clearTimeout(timer); reject(e) })
    if (opts.input !== undefined) child.stdin.end(opts.input)
    else child.stdin.end()
  })
}

export async function makeTempDir(prefix: string): Promise<string> {
  await fs.mkdir(path.join(SCRATCH, 'tmp'), { recursive: true })
  return fs.mkdtemp(path.join(SCRATCH, 'tmp', `${prefix}-`))
}

export async function makeProject(dir: string, registries?: Record<string, unknown>): Promise<void> {
  const manifest: Record<string, unknown> = {
    $schema: 'https://schema.paradoc.dev/manifest.json',
    name: '@test/test-project',
    title: 'Test Project',
    visibility: 'private',
  }
  if (registries) manifest.registries = registries
  await fs.mkdir(path.join(dir, '.paradoc'), { recursive: true })
  await fs.writeFile(path.join(dir, 'paradoc.json'), JSON.stringify(manifest, null, 2))
}

/** A self-signed cert for 127.0.0.1, generated once into the scratch folder. */
function cert(): { key: Buffer; cert: Buffer } {
  const dir = path.join(SCRATCH, 'tls')
  mkdirSync(dir, { recursive: true })
  const keyPath = path.join(dir, 'key.pem')
  const certPath = path.join(dir, 'cert.pem')
  try {
    return { key: readFileSync(keyPath), cert: readFileSync(certPath) }
  } catch {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyPath, '-out', certPath, '-days', '2', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], { stdio: 'ignore' })
    return { key: readFileSync(keyPath), cert: readFileSync(certPath) }
  }
}

export interface HttpsRegistry { url: string; requests: string[]; close: () => Promise<void> }

export async function startHttpsServer(routes: Record<string, { body: string | Buffer; type?: string }>): Promise<HttpsRegistry> {
  const requests: string[] = []
  const server: HttpsServer = createHttpsServer(cert(), (req: IncomingMessage, res: ServerResponse) => {
    const url = (req.url ?? '/').split('?')[0]!
    requests.push(url)
    const route = routes[url]
    if (!route) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end('{"error":"not found"}')
      return
    }
    res.writeHead(200, { 'Content-Type': route.type ?? 'application/json' })
    res.end(route.body)
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const { port } = server.address() as AddressInfo
  return {
    url: `https://127.0.0.1:${port}`,
    requests,
    close: () => new Promise<void>((r) => server.close(() => r())),
  }
}

export const TLS_ENV = { NODE_TLS_REJECT_UNAUTHORIZED: '0' }

export function sampleForm(name: string): Record<string, unknown> {
  return {
    $schema: 'https://schema.paradoc.dev/2026-09-24.json',
    kind: 'form',
    name,
    version: '1.0.0',
    title: 'Sample Form',
    fields: { fullName: { type: 'text', label: 'Full name' } },
  }
}

export const W9_YAML = `# Author note: keep this comment
$schema: https://schema.paradoc.dev/2026-09-24.json
kind: form
name: w9
version: 1.0.0
title: W9
fields:
  fullName:
    type: text
    label: Full name
layers:
  notes:
    kind: file
    mimeType: text/markdown
    path: ./w9.md
instructions:
  kind: file
  path: ./instr.md
  mimeType: text/markdown
`

/** A registry folder made with `registry make`, with forms/w9.yaml catalogued. */
export async function makeRegistryWithSubfolderItem(prefix: string): Promise<string> {
  const dir = await makeTempDir(prefix)
  const mk = await runCli(['registry', 'make', '--name', 'demo', '--yes'], { cwd: dir })
  if (mk.exitCode !== 0) throw new Error(`registry make failed: ${mk.stdout}${mk.stderr}`)
  await fs.mkdir(path.join(dir, 'forms'), { recursive: true })
  await fs.writeFile(path.join(dir, 'forms', 'w9.yaml'), W9_YAML)
  await fs.writeFile(path.join(dir, 'forms', 'w9.md'), '# Version one\n')
  await fs.writeFile(path.join(dir, 'forms', 'instr.md'), 'Fill it in.\n')
  const add = await runCli(['registry', 'catalog', 'add', 'forms/w9.yaml', '--yes'], { cwd: dir })
  if (add.exitCode !== 0) throw new Error(`catalog add failed: ${add.stdout}${add.stderr}`)
  return dir
}
