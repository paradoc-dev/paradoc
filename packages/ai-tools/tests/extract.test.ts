import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { executeExtract, executeRender, bytesToBase64 } from '../src'
import { MAX_LAYER_FILE_SIZE } from '../src/registry-client'

const fixturesDir = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures')
const artifact = JSON.parse(readFileSync(join(fixturesDir, 'pet-addendum.json'), 'utf-8'))
const data = JSON.parse(readFileSync(join(fixturesDir, 'pet-addendum.data.json'), 'utf-8'))
const template = new Uint8Array(readFileSync(join(fixturesDir, 'pet-addendum.pdf')))
const base_url = 'https://registry.example.test/pet-addendum'

let filledPdf: Uint8Array | undefined

const fetchFixtures: typeof globalThis.fetch = async (input) => {
	const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
	if (url === `${base_url}/pet-addendum.pdf`) return new Response(template, { headers: { 'content-type': 'application/pdf' } })
	if (url === `${base_url}/filled.pdf` && filledPdf) return new Response(filledPdf, { headers: { 'content-type': 'application/pdf' } })
	return new Response('Not found', { status: 404 })
}

async function filled(): Promise<Uint8Array> {
	if (filledPdf) return filledPdf
	const rendered = await executeRender({ source: 'artifact', artifact, base_url, data, layer: 'pdf' }, { fetch: fetchFixtures })
	expect(rendered.success).toBe(true)
	filledPdf = new Uint8Array(Buffer.from(rendered.content!, 'base64'))
	return filledPdf
}

describe('extract tool', () => {
	it('returns the SDK result for a base64 PDF', async () => {
		const pdf = await filled()
		const result = await executeExtract({ source: 'artifact', artifact, pdf: bytesToBase64(pdf) })

		expect(result.success).toBe(true)
		expect(result.data).toEqual({
			fields: { petName: 'Bella', species: 'dog', weight: 35, isVaccinated: true },
			parties: { tenant: { name: 'Jane Doe' }, landlord: { name: 'Acme Properties LLC' } },
		})
		const { form } = await import('@paradoc/core')
		const sdk = await form.from(artifact).extract(pdf)
		expect(result).toEqual({ success: true, artifact_kind: 'form', layer: sdk.layer, data: sdk.data, report: sdk.report })
	})

	it('reads the PDF from a URL through the configured fetch policy', async () => {
		await filled()
		const byUrl = await executeExtract({ source: 'artifact', artifact, pdf_url: `${base_url}/filled.pdf` }, { fetch: fetchFixtures })
		const inline = await executeExtract({ source: 'artifact', artifact, pdf: bytesToBase64(await filled()) })
		expect(byUrl).toEqual(inline)

		const refused = await executeExtract(
			{ source: 'artifact', artifact, pdf_url: `${base_url}/filled.pdf` },
			{ fetch: fetchFixtures, approvedOrigins: ['https://elsewhere.example'] },
		)
		expect(refused.success).toBe(false)
		expect(refused.data).toBeUndefined()
	})

	it('requires exactly one of pdf or pdf_url', async () => {
		const neither = await executeExtract({ source: 'artifact', artifact })
		const both = await executeExtract({ source: 'artifact', artifact, pdf: bytesToBase64(await filled()), pdf_url: `${base_url}/filled.pdf` })
		expect(neither.error?.code).toBe('invalid_input')
		expect(both.error?.code).toBe('invalid_input')
	})

	it('refuses text that is not base64', async () => {
		const result = await executeExtract({ source: 'artifact', artifact, pdf: 'not base64!' })
		expect(result.error?.code).toBe('invalid_input')
	})

	it('refuses a PDF over the layer size limit before decoding it', async () => {
		const result = await executeExtract({ source: 'artifact', artifact, pdf: 'A'.repeat(Math.ceil((MAX_LAYER_FILE_SIZE + 3) / 3) * 4) })
		expect(result.error?.code).toBe('pdf_too_large')
	})

	it('refuses an artifact that is not a form', async () => {
		const document = { kind: 'document', name: 'notice', layers: { text: { kind: 'inline', mimeType: 'text/plain', text: 'Notice' } } }
		const result = await executeExtract({ source: 'artifact', artifact: document, pdf: bytesToBase64(await filled()) })
		expect(result).toMatchObject({ success: false, artifact_kind: 'document', error: { code: 'unsupported_artifact' } })
	})

	it('passes the extraction failure code through', async () => {
		const plain = new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n')
		const result = await executeExtract({ source: 'artifact', artifact, pdf: bytesToBase64(plain) })
		expect(result).toMatchObject({ success: false, error: { code: 'no_form_fields' } })
	})
})
