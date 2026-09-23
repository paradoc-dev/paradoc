/**
 * The test registry's port and the globalSetup that provides its URL.
 *
 * A fixed port made CLI test runs from two worktrees collide, so the registry
 * now listens on a port the operating system picks, and setup hands the URL
 * to tests. TEST_REGISTRY_URL points setup at a registry started by hand.
 */

import { afterEach, describe, expect, inject, it } from 'vitest'
import type { GlobalSetupContext } from 'vitest/node'
import { startTestRegistry, type TestRegistry } from '../../test-registry/server'
import { setup } from './test-registry-server'

const started: TestRegistry[] = []
const savedOverride = process.env.TEST_REGISTRY_URL

afterEach(async () => {
  if (savedOverride === undefined) delete process.env.TEST_REGISTRY_URL
  else process.env.TEST_REGISTRY_URL = savedOverride
  await Promise.all(started.splice(0).map((registry) => registry.close()))
})

function portOf(url: string): number {
  return Number(new URL(url).port)
}

/** Runs setup with a recording `provide`, and returns what it provided. */
async function runSetup(): Promise<{ provided: Record<string, unknown>; teardown: () => Promise<void> }> {
  const provided: Record<string, unknown> = {}
  const context = {
    provide: (key: string, value: unknown) => {
      provided[key] = value
    },
  } as unknown as GlobalSetupContext
  const teardown = await setup(context)
  return { provided, teardown }
}

describe('startTestRegistry', () => {
  it('starts two registries at once on two different free ports that both serve the index', async () => {
    started.push(...(await Promise.all([startTestRegistry(), startTestRegistry()])))
    const [first, second] = started
    expect(portOf(first!.url)).toBeGreaterThan(0)
    expect(portOf(second!.url)).toBeGreaterThan(0)
    expect(portOf(first!.url)).not.toBe(portOf(second!.url))

    for (const registry of started) {
      const res = await fetch(`${registry.url}/registry.json`)
      expect(res.ok).toBe(true)
      expect((await res.json()).name).toBeDefined()
    }
  })

  it('refuses a port another registry already listens on', async () => {
    const first = await startTestRegistry()
    started.push(first)
    await expect(startTestRegistry({ port: portOf(first.url) })).rejects.toThrow(/EADDRINUSE/)
  })
})

describe('globalSetup', () => {
  it('provides the URL of the registry the suite started', async () => {
    const url = inject('testRegistryUrl')
    expect(portOf(url)).toBeGreaterThan(0)
    const res = await fetch(`${url}/registry.json`)
    expect(res.ok).toBe(true)
  })

  it('starts its own registry on a free port when no override is set, and stops it in teardown', async () => {
    delete process.env.TEST_REGISTRY_URL
    const { provided, teardown } = await runSetup()
    const url = provided.testRegistryUrl as string
    expect(url).not.toBe(inject('testRegistryUrl'))
    expect((await fetch(`${url}/registry.json`)).ok).toBe(true)

    await teardown()
    await expect(fetch(`${url}/registry.json`)).rejects.toThrow()
  })

  it('uses a TEST_REGISTRY_URL that answers, and leaves it running in teardown', async () => {
    const manual = await startTestRegistry()
    started.push(manual)
    process.env.TEST_REGISTRY_URL = `${manual.url}/`

    const { provided, teardown } = await runSetup()
    expect(provided.testRegistryUrl).toBe(manual.url)

    await teardown()
    expect((await fetch(`${manual.url}/registry.json`)).ok).toBe(true)
  })

  it('refuses a TEST_REGISTRY_URL that does not answer', async () => {
    const gone = await startTestRegistry()
    await gone.close()
    process.env.TEST_REGISTRY_URL = gone.url

    await expect(runSetup()).rejects.toThrow(/TEST_REGISTRY_URL is set, but .* does not answer/)
  })
})
