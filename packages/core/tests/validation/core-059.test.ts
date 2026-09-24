/**
 * core-059: layer reference validation kept a second, legacy slot model
 * (`signatureBlocks`) that skipped the required-signature rule.
 * Input: parties { client, guarantor } that both require a signature; one PDF
 * layer whose only slot is for client, declared under `signatures` and under
 * the removed `signatureBlocks`.
 * Expected: `signatures` reports that guarantor has no slot, and the
 * `signatureBlocks` layer is rejected instead of passing silently.
 */
import { expect, test } from 'vitest'
import { validateLayerReferences } from '@/validation/layer-references'
import { validate } from '@/validation/artifact'

const parties = {
	client: { label: 'Client', partyType: 'person', signature: { required: true } },
	guarantor: { label: 'Guarantor', partyType: 'person', signature: { required: true } },
}
const base = { kind: 'form', name: 'guaranty', version: '1.0.0', title: 'Guaranty', fields: {}, parties }
const declared = {
	...base,
	layers: { pdf: { kind: 'file', mimeType: 'application/pdf', path: 'x.pdf', signatures: { sig: { party: { role: 'client' }, type: 'signature', placement: { page: 1, x: 72, y: 600, width: 180, height: 36 } } } } },
}
const legacy = {
	...base,
	layers: { pdf: { kind: 'file', mimeType: 'application/pdf', path: 'x.pdf', signatureBlocks: { sig: { type: 'signature', page: 1, x: 72, y: 600, width: 180, height: 36, partyRole: 'client' } } } },
}

test('core-059 a required signer with no slot is reported', () => {
	const messages = validateLayerReferences(declared as never).map((issue) => issue.message)
	expect(messages.some((message) => message.includes('"guarantor" requires a signature'))).toBe(true)
})

test('core-059 the removed signatureBlocks slot model does not pass validation', () => {
	expect(validate(legacy).issues).toEqual([{ message: 'Unrecognized key: "signatureBlocks"', path: ['layers', 'pdf'] }])
})
