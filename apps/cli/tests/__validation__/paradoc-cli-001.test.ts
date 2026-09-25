import { afterEach, describe, expect, it } from 'vitest'
import { makeProject, makeTempDir, runCli, sampleForm, startHttpsServer, TLS_ENV, type HttpsRegistry } from './p1a-helpers'

describe('paradoc-cli-001: direct URL install fetches the given URL', () => {
  let server: HttpsRegistry | undefined
  afterEach(async () => { await server?.close() })

  it('installs from https://host/artifacts/my-form.json when the host has no registry index', async () => {
    server = await startHttpsServer({ '/artifacts/my-form.json': { body: JSON.stringify(sampleForm('my-form')) } })
    const dir = await makeTempDir('001a')
    await makeProject(dir)
    const result = await runCli(['add', `${server.url}/artifacts/my-form.json`, '--no-cache', '--output', 'json'], { cwd: dir, env: TLS_ENV })
    console.log('requests:', server.requests, '\n', result.stdout, result.stderr)
    expect(server.requests).toContain('/artifacts/my-form.json')
    expect(result.exitCode).toBe(0)
  }, 30000)

  it('fetches the given path, not <artifactsPath>/<name>.json, when the host has an index', async () => {
    server = await startHttpsServer({
      '/registry.json': { body: JSON.stringify({ name: 'other', artifactsPath: '/r', items: [] }) },
      '/artifacts/my-form.json': { body: JSON.stringify(sampleForm('my-form')) },
    })
    const dir = await makeTempDir('001b')
    await makeProject(dir)
    const result = await runCli(['add', `${server.url}/artifacts/my-form.json`, '--no-cache', '--output', 'json'], { cwd: dir, env: TLS_ENV })
    console.log('requests:', server.requests, '\n', result.stdout, result.stderr)
    expect(server.requests).not.toContain('/r/my-form.json')
    expect(server.requests).toContain('/artifacts/my-form.json')
  }, 30000)
})
