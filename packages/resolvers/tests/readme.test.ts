import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const run = promisify(execFile)
const packageRoot = fileURLToPath(new URL('..', import.meta.url))

describe('@paradoc/resolvers public entrypoints', () => {
  test('loads both emitted entrypoints through package exports', async () => {
    const source = [
      'import { createFsResolver } from "@paradoc/resolvers/fs"',
      'import { createMemoryResolver } from "@paradoc/resolvers/memory"',
      'if (typeof createFsResolver !== "function") process.exit(1)',
      'if (typeof createMemoryResolver !== "function") process.exit(1)',
    ].join(';')

    const result = await run(process.execPath, ['--input-type=module', '--eval', source], {
      cwd: packageRoot,
    })
    expect(result.stderr).toBe('')
  })
})
