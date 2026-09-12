/**
 * A cheap check on the generated component-docs content, the same convention
 * `components-registry.test.ts` already establishes for generated docs
 * content: the split between hand-written pages and mechanically-derived
 * content is only safe while something checks it.
 *
 * This exists specifically to catch the class of bug a manual eyeball of one
 * run's output won't reliably catch: reading a prop table from the wrong
 * source file, a leftover authoring pragma/banner making it into "consumer"
 * source, or an empty extraction silently succeeding.
 */
import { describe, expect, test } from 'vitest'

import {
  PREVIEW_SOURCES,
  PROPS_TABLES,
  USAGE_SNIPPETS,
  VARIANT_SOURCES,
} from '../src/generated/component-docs-content'
import { getBlockUsageFiles } from '../src/lib/component-registry-content'

const DOCUMENTED_COMPONENTS = [
  'bundle',
  'document',
  'field',
  'keep-together',
  'pages',
  'paper',
  'part',
  'pdf-pages',
  'qr-code',
  'section',
  'signature',
  'table',
  'totals',
]


describe.each(DOCUMENTED_COMPONENTS)('%s docs content', (name) => {
  test('has a non-empty rewritten preview source, free of authoring artifacts', () => {
    const source = PREVIEW_SOURCES[name]
    expect(source).toBeTruthy()
    expect(source).not.toContain('@jsxRuntime')
    expect(source).not.toMatch(/^\s*\/\*\*/)
    expect(source).not.toMatch(/from "\.\.?\//) // no leftover package-relative imports
  })

  test('has a 2-8 line usage snippet with a rewritten import', () => {
    const snippet = USAGE_SNIPPETS[name]
    expect(snippet).toBeTruthy()
    expect(snippet).toContain(`@/components/paradoc/${name}`)
    expect(snippet.split('\n').length).toBeLessThanOrEqual(9)
  })

  test('has at least one rewritten variant source', () => {
    const variants = VARIANT_SOURCES[name]
    expect(Object.keys(variants).length).toBeGreaterThan(0)
    for (const source of Object.values(variants)) {
      expect(source).not.toContain('@jsxRuntime')
    }
  })

  test('has a non-empty props table', () => {
    expect(PROPS_TABLES[name]?.length).toBeGreaterThan(0)
  })
})

test("field's props table matches its real, currently-shipping props interface", () => {
  // Regression check for reading the props table from the wrong file
  // (paradoc/packages/react's parallel substrate component instead of the
  // real, shipping paradoc/packages/components one): the two have already
  // diverged, so asserting the real shape here is meaningful, not tautological.
  const names = PROPS_TABLES.field?.map((prop) => prop.name).sort()
  expect(names).toEqual(['className', 'label', 'path'])
})

test("table's props table reads `columns` as the real component declares it", () => {
  // The real, shipping TableProps declares `columns: readonly TableColumn[]`;
  // packages/react's parallel (and wrong, for this purpose) TableProps drops
  // `readonly`. This is the exact drift the spec's props-table invariant
  // exists to prevent.
  const columns = PROPS_TABLES.table?.find((prop) => prop.name === 'columns')
  expect(columns?.type).toBe('readonly TableColumn[]')
})

test("pdf-pages' props table describes PdfPagesProps, not AttachmentProps", () => {
  // `pdf-pages.tsx` ships both `Attachment` and `PdfPages`; the table must
  // describe the item's primary, consumer-facing export.
  const names = PROPS_TABLES['pdf-pages']?.map((prop) => prop.name)
  expect(names).toContain('bytes')
  expect(names).toContain('onPaint')
  expect(names).not.toContain('reason') // Attachment-only
})

describe.each(['part', 'pdf-pages', 'qr-code', 'signature', 'totals'])(
  "%s's props table has no blank description",
  (name) => {
    test('every prop carries its own JSDoc description', () => {
      for (const prop of PROPS_TABLES[name] ?? []) {
        expect(prop.description, `${name}.${prop.name} has no description`).not.toBe('')
      }
    })
  }
)

const DOCUMENTED_BLOCKS = ['invoice', 'purchase-order', 'vendor-packet', 'engagement-letter']

describe.each(DOCUMENTED_BLOCKS)('%s block docs content', (name) => {
  test('has a non-empty rewritten preview source, free of authoring artifacts', () => {
    const source = PREVIEW_SOURCES[name]
    expect(source).toBeTruthy()
    expect(source).not.toContain('@jsxRuntime')
    expect(source).not.toMatch(/^\s*\/\*\*/)
    expect(source).not.toMatch(/from "\.\.?\//) // no leftover package-relative imports
  })

  test('has at least one rewritten variant source', () => {
    const variants = VARIANT_SOURCES[name]
    expect(Object.keys(variants).length).toBeGreaterThan(0)
    for (const source of Object.values(variants)) {
      expect(source).not.toContain('@jsxRuntime')
    }
  })

  test('carries no usage snippet or props table — blocks use BlockUsage instead', () => {
    // A block's Usage anatomy is genuinely different (see the spec): the full
    // composition and sample data, not an extracted call-site snippet or a
    // props table, so blocks must never end up in these base-component maps.
    expect(USAGE_SNIPPETS[name]).toBeUndefined()
    expect(PROPS_TABLES[name]).toBeUndefined()
  })

  test("its registry item's composition and sample-data files carry real content", () => {
    const { composition, data } = getBlockUsageFiles(name)
    expect(composition.content).toBeTruthy()
    expect(data.content).toBeTruthy()
  })
})

test("invoice's overflow variant renders the long sample, not the short one", () => {
  expect(VARIANT_SOURCES.invoice?.overflow).toContain('overflowInvoiceData')
  expect(VARIANT_SOURCES.invoice?.overflow).not.toContain('shortInvoiceData')
})

describe.each(['purchase-order', 'vendor-packet', 'engagement-letter'])(
  "%s's Preview and its one Variant render the same real sample",
  (name) => {
    test('the single Variant is a deliberate honest duplicate, not a fabricated scenario', () => {
      // Each of these blocks has exactly one sample-data export today; per
      // the spec, a block's Variants section shows only what already
      // exists, so this is a deliberate single entry rather than a
      // fabricated second scenario.
      expect(Object.keys(VARIANT_SOURCES[name] ?? {})).toEqual(['standard'])
      expect(VARIANT_SOURCES[name]?.standard).toBe(PREVIEW_SOURCES[name])
    })
  }
)

test("vendor-packet's Preview needs no Pages wrapper — it already self-paginates", () => {
  expect(PREVIEW_SOURCES['vendor-packet']).toContain('VendorPacketDocument')
  expect(PREVIEW_SOURCES['vendor-packet']).not.toContain('<Pages')
})

test("engagement-letter's Preview wraps the bare composition in Pages", () => {
  expect(PREVIEW_SOURCES['engagement-letter']).toContain('<Pages')
  expect(PREVIEW_SOURCES['engagement-letter']).toContain('EngagementLetterDocument')
})
