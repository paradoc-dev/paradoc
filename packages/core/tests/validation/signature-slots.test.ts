/**
 * validate() reports every layer-reference and signature-slot problem that
 * render or seal would hit: an unknown default layer, a 'flow' slot on a PDF
 * or DOCX layer or of a type flow cannot place, a slot for an undeclared role, a
 * required signature with no slot, and a 'flow' slot no directive places.
 */

import { describe, expect, it } from 'vitest'
import { createMemoryResolver } from '@paradoc/resolvers/memory'
import type { SignatureSlot } from '@paradoc/types'
import { form, validate, validateLayers } from '@/index'

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const MARKDOWN = [
  'Client signature: {{signature(parties.client, "client-sig")}}',
  'Client initials: {{initials(parties.client, "client-ini")}}',
].join('\n')

const FLOW_SLOTS: Record<string, SignatureSlot> = {
  'client-sig': { party: { role: 'client' }, type: 'signature', placement: 'flow' },
  'client-ini': { party: { role: 'client' }, type: 'initials', placement: 'flow' },
  'client-date': {
    party: { role: 'client' },
    type: 'date_signed',
    placement: { anchor: { text: 'Date:', offsetX: 40 }, width: 80, height: 14 },
  },
}

const PDF_SLOTS: Record<string, SignatureSlot> = {
  'client-sig': { party: { role: 'client' }, type: 'signature', placement: { page: 1, x: 72, y: 600, width: 180, height: 36 } },
}

interface Overrides {
  defaultLayer?: string
  md?: Record<string, SignatureSlot>
  pdf?: Record<string, SignatureSlot>
  text?: string
  parties?: Record<string, unknown>
}

/** A form with a Markdown layer of flow and anchor slots and a PDF layer of absolute slots. */
function artifact(overrides: Overrides = {}) {
  return {
    kind: 'form',
    name: 'contract',
    version: '1.0.0',
    title: 'Contract',
    fields: { amount: { type: 'number', label: 'Amount' } },
    parties: overrides.parties ?? { client: { label: 'Client', partyType: 'person', signature: { required: true } } },
    layers: {
      md: { kind: 'inline', mimeType: 'text/markdown', text: overrides.text ?? MARKDOWN, signatures: overrides.md ?? FLOW_SLOTS },
      pdf: { kind: 'file', mimeType: 'application/pdf', path: 'contract.pdf', signatures: overrides.pdf ?? PDF_SLOTS },
    },
    defaultLayer: overrides.defaultLayer ?? 'md',
  }
}

function messages(result: ReturnType<typeof validate>): string[] {
  return (result.issues ?? []).map((issue) => issue.message)
}

describe('validate() layer references', () => {
  it('passes a form whose slots use each placement correctly', () => {
    const result = validate(artifact())
    expect(result.issues).toBeUndefined()
  })

  it('reports a defaultLayer that names no layer', () => {
    const result = validate(artifact({ defaultLayer: 'markdown' }))
    expect(result.issues).toEqual([{
      message: 'defaultLayer "markdown" names no layer; declared layers: "md", "pdf"',
      path: ['defaultLayer'],
    }])
  })

  it('reports an unknown defaultLayer on a document and on a checklist', () => {
    const document = { kind: 'document', name: 'notice', version: '1.0.0', title: 'Notice', defaultLayer: 'body' }
    expect(messages(validate(document))).toEqual(['defaultLayer "body" names no layer; declared layers: none'])
    const checklist = {
      kind: 'checklist',
      name: 'steps',
      version: '1.0.0',
      title: 'Steps',
      items: [{ id: 'one', title: 'One' }],
      layers: { md: { kind: 'inline', mimeType: 'text/markdown', text: 'Steps' } },
      defaultLayer: 'html',
    }
    expect(messages(validate(checklist))).toEqual(['defaultLayer "html" names no layer; declared layers: "md"'])
  })

  it('reports a flow slot on a PDF layer', () => {
    const result = validate(artifact({ pdf: { 'client-sig': { party: { role: 'client' }, type: 'signature', placement: 'flow' } } }))
    expect(result.issues).toEqual([{
      message: 'Layer "pdf", slot "client-sig": \'flow\' placement needs a text-template layer; PDF layers use absolute or anchor placement',
      path: ['layers', 'pdf', 'signatures', 'client-sig'],
    }])
  })

  it('reports a flow slot whose type is not a signature kind', () => {
    const result = validate(artifact({
      md: { ...FLOW_SLOTS, 'client-date': { party: { role: 'client' }, type: 'date_signed', placement: 'flow' } },
    }))
    expect(result.issues).toEqual([{
      message: 'Layer "md", slot "client-date": \'flow\' placement supports signature and initials, not "date_signed"',
      path: ['layers', 'md', 'signatures', 'client-date'],
    }])
  })

  it('reports a slot for a party role the form does not declare', () => {
    const result = validate(artifact({
      pdf: { ...PDF_SLOTS, 'witness-sig': { party: { role: 'witness' }, type: 'signature', placement: { page: 1, x: 72, y: 500, width: 180, height: 36 } } },
    }))
    expect(result.issues).toEqual([{
      message: 'Layer "pdf", slot "witness-sig": party role "witness" is not declared; declared roles: "client"',
      path: ['layers', 'pdf', 'signatures', 'witness-sig'],
    }])
  })

  it('reports a legacy signature block for an undeclared party role', () => {
    const form = artifact()
    const result = validate({
      ...form,
      layers: {
        ...form.layers,
        legacy: {
          kind: 'file',
          mimeType: 'application/pdf',
          path: 'legacy.pdf',
          signatureBlocks: { sig: { type: 'signature', page: 1, x: 72, y: 600, width: 180, height: 36, partyRole: 'witness' } },
        },
      },
    })
    expect(result.issues).toEqual([{
      message: 'Layer "legacy", slot "sig": party role "witness" is not declared; declared roles: "client"',
      path: ['layers', 'legacy', 'signatureBlocks', 'sig'],
    }])
  })

  it('reports a party whose signature is required but has no slot on a layer', () => {
    const parties = {
      client: { label: 'Client', partyType: 'person', signature: { required: true } },
      guarantor: { label: 'Guarantor', partyType: 'person', signature: { required: true } },
      notary: { label: 'Notary', partyType: 'person', signature: { required: false } },
    }
    const result = validate(artifact({ parties }))
    expect(result.issues).toEqual([
      { message: 'Layer "md": party role "guarantor" requires a signature but no slot on this layer places it', path: ['layers', 'md', 'signatures'] },
      { message: 'Layer "pdf": party role "guarantor" requires a signature but no slot on this layer places it', path: ['layers', 'pdf', 'signatures'] },
    ])
  })

  it('reports a flow slot that no directive in an inline template places', () => {
    const result = validate(artifact({ text: 'Client signature: {{signature(parties.client, "client-sig")}}\nClient initials: {{signature(parties.client, "client-ini")}}' }))
    expect(result.issues).toEqual([{
      message: 'Layer "md", slot "client-ini": no {{initials(..., "client-ini")}} in the template places this \'flow\' slot',
      path: ['layers', 'md', 'signatures', 'client-ini'],
    }])
  })

  it('counts directives inside blocks, and a computed location as placing any slot of its type', () => {
    const text = [
      '{{#if fields.amount > 0}}{{signature(parties.client, "client-sig")}}{{/if}}',
      '{{initials(parties.client, "client-" + "ini")}}',
    ].join('\n')
    expect(validate(artifact({ text })).issues).toBeUndefined()
  })

  it('stops at the first reference problem when not collecting all errors', () => {
    const broken = artifact({ defaultLayer: 'nope', pdf: { 'client-sig': { party: { role: 'client' }, type: 'signature', placement: 'flow' } } })
    expect(validate(broken).issues).toHaveLength(2)
    expect(messages(validate(broken, { collectAllErrors: false }))).toEqual([
      'defaultLayer "nope" names no layer; declared layers: "md", "pdf"',
    ])
  })

  it('reports only the template error when an inline template does not parse', () => {
    expect(messages(validate(artifact({ text: '{{#if fields.amount > 0}}{{signature(parties.client, "client-sig")}}' })))).toEqual([
      expect.stringMatching(/^Template error at layer "md"/),
    ])
  })

  it('leaves reference problems to seal when filling, so a draft still fills', () => {
    const broken = artifact({ defaultLayer: 'nope', text: 'No signature lines.' })
    expect(validate(broken).issues).toHaveLength(3)
    expect(() => form(broken as never).fill({ fields: { amount: 1 } })).not.toThrow()
  })

  it('skips reference checks when schema validation is off', () => {
    expect(validate(artifact({ defaultLayer: 'nope' }), { schema: false }).issues).toBeUndefined()
  })
})

describe('validateLayers() flow placement in file templates', () => {
  const fileForm = (mimeType: string, path: string) => ({
    kind: 'form',
    name: 'contract',
    version: '1.0.0',
    title: 'Contract',
    parties: { client: { label: 'Client', partyType: 'person' } },
    layers: { contract: { kind: 'file', mimeType, path, signatures: { 'client-sig': FLOW_SLOTS['client-sig']! } } },
  })

  it('passes a text file layer whose template places its flow slot, and reports one that does not', async () => {
    const form = fileForm('text/markdown', 'contract.md')
    const placed = await validateLayers(form, { resolver: createMemoryResolver({ contents: { 'contract.md': '{{signature(parties.client, "client-sig")}}' } }) })
    expect(placed.issues).toBeUndefined()
    const missing = await validateLayers(form, { resolver: createMemoryResolver({ contents: { 'contract.md': '{{signature(parties.client, "other")}}' } }) })
    expect(missing.issues).toEqual([{
      message: 'Layer "contract", slot "client-sig": no {{signature(..., "client-sig")}} in the template places this \'flow\' slot',
      path: ['layers', 'contract', 'signatures', 'client-sig'],
    }])
  })

  it('passes a React layer with flow slots, whose template is code', async () => {
    const react = fileForm('text/tsx', 'contract.tsx')
    const result = await validateLayers(react, { resolver: createMemoryResolver({ contents: { 'contract.tsx': 'export default () => null' } }) })
    expect(result.issues).toBeUndefined()
  })

  it('reports only the template error when a file template does not parse', async () => {
    const form = fileForm('text/markdown', 'contract.md')
    const result = await validateLayers(form, { resolver: createMemoryResolver({ contents: { 'contract.md': '{{#each x}}' } }) })
    expect(result.issues?.map((issue) => issue.message)).toEqual([expect.stringMatching(/^Template error at layer "contract"/)])
  })

  it('reports a flow slot on a DOCX layer, whose engine draws no marker', () => {
    expect(validate(fileForm(DOCX, 'contract.docx')).issues).toEqual([{
      message: 'Layer "contract", slot "client-sig": \'flow\' placement needs a text-template layer; DOCX layers use absolute or anchor placement',
      path: ['layers', 'contract', 'signatures', 'client-sig'],
    }])
  })
})
