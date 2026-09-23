/**
 * Vitest globalSetup: creates one temporary root for the per-worker home
 * directories (see `isolate-home.ts`) and removes it after the run.
 *
 * Tests must never read or write the real `~/.paradoc`. Tests read the root
 * with `inject('testHomeRoot')`.
 */

import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { GlobalSetupContext } from 'vitest/node'

declare module 'vitest' {
  export interface ProvidedContext {
    testHomeRoot: string
  }
}

export function setup({ provide }: GlobalSetupContext): () => void {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'paradoc-cli-home-')))
  provide('testHomeRoot', root)
  return () => {
    rmSync(root, { recursive: true, force: true })
  }
}
