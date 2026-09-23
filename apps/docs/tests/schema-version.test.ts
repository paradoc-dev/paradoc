/**
 * Docs pages never hand-write a schema version. They write a token that
 * `remarkSchemaVersion` fills from `@paradoc/schemas` at build time.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { SCHEMA_VERSION, SCHEMA_VERSIONS } from '@paradoc/schemas'
import {
  fillSchemaVersion,
  PREVIOUS_SCHEMA_VERSION_TOKEN,
  remarkSchemaVersion,
  SCHEMA_VERSION_TOKEN,
} from '@/lib/schema-version'

const contentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../content/docs')
const previousVersion = SCHEMA_VERSIONS[SCHEMA_VERSIONS.length - 2]

const DATED_SCHEMA_URL = /schema\.paradoc\.dev\/\d{4}-\d{2}-\d{2}/
/** A row of the version history table on the schemas page, which names each version on purpose. */
const VERSION_HISTORY_ROW = /^\| `\d{4}-\d{2}-\d{2}` \|/

/**
 * Lines of one page that hand-write a schema version instead of a token: a
 * dated schema address, or a published version on a line about the schema.
 * A version date elsewhere, such as an example timestamp, is only a date.
 */
function handWrittenVersions(file: string, text: string): string[] {
  return text
    .split('\n')
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => !(file === 'schemas/index.mdx' && VERSION_HISTORY_ROW.test(line)))
    .filter(({ line }) => DATED_SCHEMA_URL.test(line) || (/schema/i.test(line) && SCHEMA_VERSIONS.some((version) => line.includes(version))))
    .map(({ line, number }) => `${file}:${number}: ${line.trim()}`)
}

function contentPages(dir = contentRoot): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return contentPages(full)
    return entry.name.endsWith('.mdx') ? [path.relative(contentRoot, full)] : []
  })
}

describe('schema version tokens', () => {
  test('fill the current and previous version', () => {
    expect(fillSchemaVersion(`https://schema.paradoc.dev/${SCHEMA_VERSION_TOKEN}.json`)).toBe(
      `https://schema.paradoc.dev/${SCHEMA_VERSION}.json`,
    )
    expect(fillSchemaVersion(`${PREVIOUS_SCHEMA_VERSION_TOKEN} → ${SCHEMA_VERSION_TOKEN}`)).toBe(
      `${previousVersion} → ${SCHEMA_VERSION}`,
    )
  })

  test('leave text without a token unchanged', () => {
    expect(fillSchemaVersion('SCHEMA_VERSION // no token here')).toBe('SCHEMA_VERSION // no token here')
  })

  test('the remark plugin fills code and inline code, and not prose', () => {
    const tree = {
      type: 'root',
      children: [
        { type: 'code', value: `"$schema": "https://schema.paradoc.dev/${SCHEMA_VERSION_TOKEN}.json"` },
        { type: 'paragraph', children: [
          { type: 'inlineCode', value: SCHEMA_VERSION_TOKEN },
          { type: 'text', value: SCHEMA_VERSION_TOKEN },
        ] },
      ],
    }
    remarkSchemaVersion()(tree)
    expect(tree).toEqual({
      type: 'root',
      children: [
        { type: 'code', value: `"$schema": "https://schema.paradoc.dev/${SCHEMA_VERSION}.json"` },
        { type: 'paragraph', children: [
          { type: 'inlineCode', value: SCHEMA_VERSION },
          { type: 'text', value: SCHEMA_VERSION_TOKEN },
        ] },
      ],
    })
  })
})

describe('docs content', () => {
  test('flags a hand-written schema version, stale or current', () => {
    expect(handWrittenVersions('guides/forms.mdx', '  "$schema": "https://schema.paradoc.dev/2026-08-06.json",')).toHaveLength(1)
    expect(handWrittenVersions('guides/forms.mdx', '$schema: https://schema.paradoc.dev/1999-01-01.json')).toHaveLength(1)
    expect(handWrittenVersions('mcp/tools/validate.mdx', `    "schema": "${SCHEMA_VERSION}",`)).toHaveLength(1)
    expect(handWrittenVersions('schemas/index.mdx', `The current schema version is \`${SCHEMA_VERSION}\`.`)).toHaveLength(1)
  })

  test('accepts tokens and the version history table', () => {
    expect(handWrittenVersions('guides/forms.mdx', `"$schema": "https://schema.paradoc.dev/${SCHEMA_VERSION_TOKEN}.json"`)).toEqual([])
    expect(handWrittenVersions('schemas/index.mdx', `| \`${SCHEMA_VERSION}\` | Adds list fields. |`)).toEqual([])
    expect(handWrittenVersions('ai/tools/fill.mdx', `"asOf": { "date": "${SCHEMA_VERSION}" }`)).toEqual([])
  })

  test('no page hand-writes a schema version', () => {
    // The changelog page is generated from CHANGELOG.md and names past versions on purpose.
    const pages = contentPages().filter((file) => file !== path.join('changelog', 'index.mdx'))
    expect(pages.length).toBeGreaterThan(20)
    const found = pages.flatMap((file) => handWrittenVersions(file, readFileSync(path.join(contentRoot, file), 'utf8')))
    expect(found).toEqual([])
  })
})
