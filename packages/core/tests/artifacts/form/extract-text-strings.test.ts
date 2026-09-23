import { describe, expect, test } from 'vitest'
import { p } from '@/artifacts'

/**
 * `form.extract` reads field values as PDF text strings: UTF-16BE after a
 * FE FF byte order mark, PDFDocEncoding otherwise. The byte 0x87 in "文"
 * (FE FF 65 87) and PDFDocEncoding's "•" (0x80) and "—" (0x84) are where a
 * windows-1252 reading goes wrong.
 */

const encoder = new TextEncoder()

/** A one-page PDF with a text field `name` whose `/V` is the given hex string. */
function oneFieldPdf(valueHex: string): Uint8Array {
	const objects = [
		'<< /Type /Catalog /Pages 2 0 R /AcroForm 5 0 R >>',
		'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
		'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << >> /Annots [4 0 R] >>',
		`<< /FT /Tx /T (name) /Subtype /Widget /Rect [20 250 280 268] /P 3 0 R /V <${valueHex}> >>`,
		'<< /Fields [4 0 R] >>',
	]
	let body = '%PDF-1.7\n'
	const offsets: number[] = []
	objects.forEach((object, index) => {
		offsets.push(body.length)
		body += `${index + 1} 0 obj\n${object}\nendobj\n`
	})
	const xref = body.length
	body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
	body += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
	body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
	return encoder.encode(body)
}

const form = p.form({
	kind: 'form',
	name: 'extract-text-strings',
	version: '1.0.0',
	title: 'Extract text strings',
	fields: { name: { type: 'text', label: 'Name' } },
	layers: {
		pdf: { kind: 'file', mimeType: 'application/pdf', path: 'form.pdf', bindings: { name: 'name' } },
	},
	defaultLayer: 'pdf',
})

describe('form.extract text strings', () => {
	test('reads a UTF-16BE CJK value', async () => {
		const { data } = await form.extract(oneFieldPdf('FEFF65875B57'))
		expect(data.fields).toEqual({ name: '文字' })
	})

	test('reads a PDFDocEncoded value', async () => {
		const { data } = await form.extract(oneFieldPdf('8020412084'))
		expect(data.fields).toEqual({ name: '• A —' })
	})
})
