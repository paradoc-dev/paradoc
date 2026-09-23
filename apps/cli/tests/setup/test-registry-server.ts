/**
 * Vitest globalSetup: starts the test registry before all tests.
 *
 * The registry listens on a port the operating system picks, so CLI test runs
 * in parallel (for example from two worktrees) do not collide. Tests read its
 * base URL with `inject('testRegistryUrl')`.
 *
 * To run the tests against a registry you started yourself, set
 * TEST_REGISTRY_URL (for example `http://localhost:4567` after
 * `pnpm test-registry`). Setup then checks that it answers and starts none.
 */

import type { GlobalSetupContext } from 'vitest/node'
import { startTestRegistry } from '../../test-registry/server'

declare module 'vitest' {
  export interface ProvidedContext {
    testRegistryUrl: string
  }
}

async function assertRegistryAnswers(url: string): Promise<void> {
  const indexUrl = `${url.replace(/\/+$/, '')}/registry.json`
  let status: string
  try {
    const res = await fetch(indexUrl, { signal: AbortSignal.timeout(2000) })
    if (res.ok) return
    status = `HTTP ${res.status}`
  } catch (error) {
    status = error instanceof Error ? error.message : String(error)
  }
  throw new Error(`TEST_REGISTRY_URL is set, but ${indexUrl} does not answer (${status})`)
}

export async function setup({ provide }: GlobalSetupContext): Promise<() => Promise<void>> {
  const override = process.env.TEST_REGISTRY_URL
  if (override) {
    await assertRegistryAnswers(override)
    provide('testRegistryUrl', override.replace(/\/+$/, ''))
    return async () => {
      // Don't stop a server we didn't start
    }
  }

  const registry = await startTestRegistry()
  provide('testRegistryUrl', registry.url)
  return registry.close
}
