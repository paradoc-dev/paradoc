import { createFormatter } from '@paradoc/format'
import type { FormatResult, Form, Formatter } from '@paradoc/types'
import { unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

import { renderDocx } from '../src/docx'
import { inspectAcroFormFields, renderPdf } from '../src/pdf'
import { renderText } from '../src/text'
import { formatFieldValue } from '../src/text/field-formatter'
import { compressedCheckboxPdf, pagePdf, textFieldsPdf } from './pdf-fixtures'
import { textItemsWithPdfjs } from './pdfjs-reference'

const decoder = new TextDecoder()
const encoder = new TextEncoder()

const SERVICES = [
	{ value: 'plumbing', label: 'Plumbing' },
	{ value: 'wiring', label: 'Wiring' },
	{ value: 'roofing', label: 'Roofing' },
]

const form = {
	kind: 'form',
	name: 'survey',
	version: '1.0.0',
	title: 'Survey',
	fields: {
		enabled: { type: 'boolean' },
		choice: { type: 'enum', enum: SERVICES },
		choices: { type: 'multiselect', enum: SERVICES },
		score: { type: 'rating', min: 1, max: 5 },
		unscored: { type: 'rating' },
	},
} as unknown as Form

const data = { enabled: true, choice: 'wiring', choices: ['plumbing', 'roofing'], score: 4, unscored: 3 }
const names = ['enabled', 'choice', 'choices', 'score', 'unscored'] as const
const template = names.map((name) => `{{fields.${name}}}`).join('|')

function minimalDocx(document: string): Uint8Array {
	return zipSync({
		'[Content_Types].xml': encoder.encode('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
		'_rels/.rels': encoder.encode('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
		'word/document.xml': encoder.encode(document),
	})
}

function docxText(bytes: Uint8Array): string {
	return [...decoder.decode(unzipSync(bytes)['word/document.xml']).matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
		.map((match) => match[1])
		.join('')
}

async function docxOutput(formatter: Formatter): Promise<string[]> {
	const rendered = await renderDocx({
		template: minimalDocx(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${template}</w:t></w:r></w:p></w:body></w:document>`),
		form,
		formatter,
		data,
	})
	return docxText(rendered).split('|')
}

async function pdfOutput(formatter: Formatter): Promise<string[]> {
	const filled = await renderPdf({
		template: textFieldsPdf([...names]),
		form,
		formatter,
		data,
		bindings: Object.fromEntries(names.map((name) => [name, name])),
	})
	const fields = new Map((await inspectAcroFormFields(filled)).map((field) => [field.name, field.value as string]))
	return names.map((name) => fields.get(name) ?? '')
}

async function everyOutput(formatter: Formatter): Promise<Record<'text' | 'docx' | 'pdf', string[]>> {
	return {
		text: renderText({ form, formatter, template, data }).split('|'),
		docx: await docxOutput(formatter),
		pdf: await pdfOutput(formatter),
	}
}

describe('selection and rating values across the outputs', () => {
	it('prints the same boolean, enum, multiselect, and rating text in text and DOCX', async () => {
		const outputs = await everyOutput(createFormatter())
		expect(outputs.text).toEqual(['Yes', 'Wiring', 'Plumbing and Roofing', '4 of 5', '3'])
		expect(outputs.docx).toEqual(outputs.text)
	})

	it('draws choice values, not labels, as PDF overlay text', async () => {
		const drawn = await renderPdf({
			template: pagePdf([[300, 300]]),
			form,
			formatter: createFormatter(),
			data,
			overlays: [{ page: 1, x: 20, y: 20, field: 'choice' }, { page: 1, x: 20, y: 60, field: 'choices' }],
		})
		const text = (await textItemsWithPdfjs(drawn)).map((item) => item.text)
		expect(text).toEqual(expect.arrayContaining(['wiring', 'plumbing, roofing']))
		expect(text.join(' ')).not.toMatch(/Wiring|Plumbing/)
	})

	it('writes choice values, not labels, into PDF boxes', async () => {
		// A PDF box takes the code the form expects; the label is for reading.
		const outputs = await everyOutput(createFormatter())
		expect(outputs.pdf).toEqual(['Yes', 'wiring', 'plumbing, roofing', '4 of 5', '3'])
	})

	it('follows the document locale in every output', async () => {
		const german = await everyOutput(createFormatter({ locale: 'de-DE' }))
		expect(german.text).toEqual(['Ja', 'Wiring', 'Plumbing und Roofing', '4 von 5', '3'])
		expect(german.docx).toEqual(german.text)
		expect(german.pdf).toEqual(['Ja', 'wiring', 'plumbing, roofing', '4 von 5', '3'])

		const arabic = createFormatter({ locale: 'ar-SA' })
		const text = renderText({ form, formatter: arabic, template, data }).split('|')
		expect(text).toEqual(['نعم', 'Wiring', 'Plumbing وRoofing', '٤ من ٥', '٣'])
		expect(await docxOutput(arabic)).toEqual(text)
		// The list reads right to left: the conjunction joins the second label,
		// and no left-to-right mark is inserted ahead of it.
		expect(text[2]).toBe(`Plumbing و${'Roofing'}`)
		expect(text.join('')).not.toMatch(/[\u200E\u202A\u202D]/)
	})

	it('still refuses an Arabic run on the native PDF writer, rather than printing it wrong', async () => {
		// PDF form filling draws no shaped scripts, whatever font is available;
		// right-to-left PDF output is the React composition path's capability,
		// not something formatting can add.
		await expect(pdfOutput(createFormatter({ locale: 'ar-SA' }))).rejects.toMatchObject({ reason: 'unsupported-script', script: 'Arabic' })
	})

	it('prints a rating with no declared scale as the plain number', () => {
		const formatted = formatFieldValue(createFormatter(), form.fields!.unscored!, 3, 'fields.unscored')
		expect(String(formatted)).toBe('3')
		// A rating that does declare a scale prints against it.
		expect(String(formatFieldValue(createFormatter(), form.fields!.score!, 4, 'fields.score'))).not.toBe('4')
	})

	it('falls back to a comma join when the runtime carries no list conjunction', () => {
		const base = createFormatter()
		const withoutLists: Formatter = Object.assign(Object.create(base) as Formatter, {
			safeFormatMultiselect: (): FormatResult => ({
				success: false,
				status: 'unsupported',
				issues: [{ code: 'unsupported_list', message: 'no list conjunction', kind: 'multiselect' }],
			}),
			safeFormatEnum: (value: unknown, options: never) => base.safeFormatEnum(value as string, options),
		})
		const formatted = formatFieldValue(withoutLists, form.fields!.choices!, ['plumbing', 'roofing'], 'fields.choices')
		expect(String(formatted)).toBe('Plumbing, Roofing')
	})

	it('refuses a value no option declares, and a malformed selection value', () => {
		const formatter = createFormatter()
		expect(() => renderText({ form, formatter, template, data: { ...data, choice: 'painting' } }))
			.toThrowError(expect.objectContaining({ path: 'fields.choice', status: 'invalid' }))
		expect(() => renderText({ form, formatter, template, data: { ...data, choices: ['plumbing', 'painting'] } }))
			.toThrowError(expect.objectContaining({ path: 'fields.choices', status: 'invalid' }))
		expect(() => renderText({ form, formatter, template, data: { ...data, enabled: 'yes' } }))
			.toThrowError(expect.objectContaining({ path: 'fields.enabled', status: 'invalid' }))
		expect(() => renderText({ form, formatter, template, data: { ...data, score: 'four' } }))
			.toThrowError(expect.objectContaining({ path: 'fields.score', status: 'invalid' }))
	})

	it('keeps a checkbox reading the stored value rather than the formatted label', async () => {
		const filled = await renderPdf({
			template: compressedCheckboxPdf(['enabled', 'choices:plumbing', 'choices:wiring']),
			form,
			formatter: createFormatter({ locale: 'de-DE' }),
			data,
			bindings: { enabled: 'enabled', 'choices:plumbing': 'choices:plumbing', 'choices:wiring': 'choices:wiring' },
		})
		expect(Object.fromEntries((await inspectAcroFormFields(filled)).map((field) => [field.name, field.value])))
			.toMatchObject({ enabled: true, 'choices:plumbing': true, 'choices:wiring': false })
	})
})
