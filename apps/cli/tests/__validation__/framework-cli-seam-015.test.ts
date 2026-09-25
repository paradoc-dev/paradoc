import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const cliDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const cli = JSON.parse(readFileSync(path.join(cliDirectory, 'package.json'), 'utf8'))
const shim = JSON.parse(readFileSync(path.join(cliDirectory, '../paradoc-cli/package.json'), 'utf8'))

describe('framework-cli-seam-015: CLI package manifests stay in step', () => {
  it.each(['version', 'keywords', 'license', 'author', 'engines', 'homepage', 'bugs'])(
    'shares the %s field',
    (field) => expect(cli[field]).toEqual(shim[field]),
  )

  it('contains no duplicate keywords', () => {
    expect(cli.keywords).toHaveLength(new Set(cli.keywords).size)
  })
})
