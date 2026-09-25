import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildPage } from '../scripts/sync-changelog'
import { prTitlesSince } from '../scripts/changelog-draft'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

describe('changelog tooling', () => {
  it('drafts only commits that touched the public subtree', () => {
    const repository = mkdtempSync(path.join(tmpdir(), 'paradoc-changelog-'))
    try {
      execFileSync('git', ['init'], { cwd: repository })
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repository })
      execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repository })
      mkdirSync(path.join(repository, 'platform'))
      writeFileSync(path.join(repository, 'platform/private.txt'), 'private')
      execFileSync('git', ['add', '.'], { cwd: repository })
      execFileSync('git', ['commit', '-m', 'fix(platform): private only'], { cwd: repository })
      mkdirSync(path.join(repository, 'paradoc'))
      writeFileSync(path.join(repository, 'paradoc/public.txt'), 'public')
      execFileSync('git', ['add', '.'], { cwd: repository })
      execFileSync('git', ['commit', '-m', 'fix(docs): public change'], { cwd: repository })

      expect(prTitlesSince(null, repository)).toEqual(['fix(docs): public change'])
    } finally {
      rmSync(repository, { recursive: true, force: true })
    }
  }, 60_000)

  it('generates compilable MDX from angle brackets and braces in prose', async () => {
    const markdown = [
      '# Changelog',
      '',
      '## [9.9.9] - 2026-09-25',
      '',
      '- Typed as Array<string> with {name}',
      '- Kept `Array<string>` and `{name}` as code',
    ].join('\n')
    const page = buildPage(markdown)
    const fumadocs = realpathSync(path.resolve(root, 'node_modules/fumadocs-mdx'))
    const { compile } = await import(
      pathToFileURL(path.join(fumadocs, '../@mdx-js/mdx/index.js')).href
    )
    const body = page.replace(/^---[\s\S]*?---\n/, '')

    expect(page).toContain('Array&lt;string> with &#123;name&#125;')
    expect(page).toContain('`Array<string>` and `{name}`')
    await expect(compile(body)).resolves.toBeDefined()
  })
})
