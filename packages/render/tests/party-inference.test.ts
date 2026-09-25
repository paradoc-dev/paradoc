import { defaultFormatter } from '@paradoc/format'
import type { Form } from '@paradoc/types'
import { describe, expect, it } from 'vitest'

import { inspectAcroFormFields, pdfRenderer } from '../src/pdf'
import { formatDefinitionValue } from '../src/text/field-formatter'
import { textRenderer } from '../src/text'
import { textFieldsPdf } from './pdf-fixtures'

const party = { id: 'landlord-0', name: 'Pat Jones' }

function artifact(partyType?: 'any'): Form {
	return {
		kind: 'form',
		name: 'lease',
		version: '1.0.0',
		fields: {},
		parties: { landlord: { label: 'Landlord', ...(partyType ? { partyType } : {}) } },
	} as Form
}

describe('party identity inference during rendering', () => {
	it.each([
		['text/plain', 'any'],
		['text/markdown', 'any'],
		['text/plain', undefined],
	] as const)('renders a name-only party as a person for %s with role type %s', (mimeType, partyType) => {
		expect(textRenderer().render({
			kind: 'form',
			template: { type: 'text', mimeType, content: 'Landlord: {{parties.landlord}}' },
			data: { fields: {}, parties: { landlord: party } },
			artifact: artifact(partyType),
		} as never)).toBe('Landlord: Pat Jones')
	})

	it('renders a name-only party into a PDF binding', async () => {
		const bytes = await pdfRenderer().render({
			kind: 'form',
			template: { type: 'pdf', content: textFieldsPdf(['landlord']), bindings: { landlord: 'parties.landlord' } },
			data: { fields: {}, parties: { landlord: party } },
			artifact: artifact('any'),
		} as never)
		expect((await inspectAcroFormFields(bytes))[0]?.value).toBe('Pat Jones')
	})

	it('uses the same inference for a party definition value', () => {
		expect(String(formatDefinitionValue(defaultFormatter, 'party', party, 'defs.owner'))).toBe('Pat Jones')
	})
})
