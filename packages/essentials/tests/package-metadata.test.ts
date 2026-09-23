/**
 * The npm description and keywords must describe the forms this package
 * actually exports. Each keyword maps to the form codes it advertises; a
 * keyword with no mapping, or one mapped to a form that is not exported,
 * fails.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as essentials from '../src/index.js'

type Manifest = { description: string; keywords: string[] }

const manifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as Manifest

const exportedCodes = Object.values(essentials).map(
  (form) => (form.spec as { code: string }).code,
)
const governmentCodes = Object.values(essentials)
  .map((form) => form.spec as { code: string; metadata?: { issuer?: string } })
  .filter((spec) => spec.metadata?.issuer)
  .map((spec) => spec.code)

const achCodes = exportedCodes.filter((code) => code.startsWith('ACH-'))

const ALL = exportedCodes
const KEYWORD_FORMS: Record<string, string[]> = {
  paradoc: ALL,
  forms: ALL,
  artifacts: ALL,
  'business-forms': ALL,
  irs: ['W-9', '1099-NEC', '1099-MISC', '4506-T'],
  w9: ['W-9'],
  '1099': ['1099-NEC', '1099-MISC'],
  '4506-t': ['4506-T'],
  uscis: ['I-9'],
  i9: ['I-9'],
  nacha: achCodes,
  ach: achCodes,
}

describe('package metadata', () => {
  it('lists each keyword once', () => {
    expect(new Set(manifest.keywords).size).toBe(manifest.keywords.length)
  })

  it('advertises only keywords backed by exported forms', () => {
    for (const keyword of manifest.keywords) {
      const forms = KEYWORD_FORMS[keyword]
      expect(forms, `keyword "${keyword}" maps to no exported form`).toBeDefined()
      expect(forms!.length, `keyword "${keyword}" maps to no exported form`).toBeGreaterThan(0)
      for (const code of forms!) expect(exportedCodes).toContain(code)
    }
  })

  it('rejects a keyword for a form family the package does not ship', () => {
    for (const keyword of ['hipaa', 'acord', 'nda']) {
      expect(manifest.keywords).not.toContain(keyword)
      expect(KEYWORD_FORMS[keyword]).toBeUndefined()
    }
  })

  it('names every exported government form in the description', () => {
    expect(governmentCodes.length).toBeGreaterThan(0)
    for (const code of governmentCodes) expect(manifest.description).toContain(code)
    expect(manifest.description).toContain('NACHA ACH')
  })

  it('does not name a form family the package does not ship in the description', () => {
    expect(manifest.description).not.toMatch(/HIPAA|ACORD|\bNDA\b/)
  })
})
