import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test, expect, vi } from 'vitest'
import { form, runtimeFormFromJSON, SealConfigError } from '@/artifacts'
import type { SealOptions, SignableForm } from '@/artifacts'
import type { SealAdapter, SealAdapterRequest, SealLocator, SigningField, Signer, SignatureSlot } from '@paradoc/types'
import { flattenPdf } from '@paradoc/render/pdf'
import { fromYAML } from '@/serialization'

/**
 * Tests for formal signing functionality.
 *
 * These tests cover the formal signing features added to SignableForm and DraftForm,
 * including the signatureMap, canonicalPdfHash, and related helper methods.
 */
describe('Formal Signing', () => {
	// ============================================================================
	// Test Fixtures
	// ============================================================================

	/** A real one-page PDF the mock converter returns. */
	const fixturePdf = new Uint8Array(readFileSync(join(__dirname, 'fixtures', 'one-field-form.pdf')))

	const sha256Of = async (bytes: Uint8Array): Promise<string> => {
		const digest = await globalThis.crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer)
		return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
	}

	/** Core flattens the converted PDF, then hashes the flattened bytes. */
	const flattenedFixture = async (): Promise<Uint8Array> => flattenPdf(fixturePdf)
	const expectedHash = async (): Promise<string> => sha256Of(await flattenedFixture())

	const createFormWithSignature = (signatures?: Record<string, SignatureSlot>) =>
		form()
			.name('lease-agreement')
			.version('1.0.0')
			.title('Lease Agreement')
			.fields({
				rentAmount: { type: 'number', label: 'Rent Amount', required: true },
				moveInDate: { type: 'date', label: 'Move-in Date', required: true },
			})
			.parties({
				landlord: {
					label: 'Landlord',
					partyType: 'person',
					signature: { required: true },
				},
				tenant: {
					label: 'Tenant',
					partyType: 'person',
					min: 1,
					max: 4,
					signature: { required: true },
				},
			})
			.inlineLayer('markdown', {
				mimeType: 'text/markdown',
				text: 'Lease template',
				...(signatures && { signatures }),
			})
			.defaultLayer('markdown')
			.build()

	const createFormWithoutSignature = () =>
		form()
			.name('simple-form')
			.version('1.0.0')
			.title('Simple Form')
			.fields({
				name: { type: 'text', label: 'Name', required: true },
			})
			.parties({
				applicant: {
					label: 'Applicant',
					partyType: 'person',
					// No signature required
				},
			})
			.inlineLayer('markdown', { mimeType: 'text/markdown', text: 'Simple template' })
			.defaultLayer('markdown')
			.build()

	const defaultSignatureMap = (): SigningField[] => [
		{ id: 'sig-landlord-0', signerIndex: 0, signerId: 'landlord-signer', type: 'signature', page: 1, x: 100, y: 500, width: 200, height: 50 },
		{ id: 'sig-tenant-0', signerIndex: 1, signerId: 'tenant-signer', type: 'signature', page: 1, x: 100, y: 600, width: 200, height: 50 },
		{ id: 'initials-tenant-0', signerIndex: 1, signerId: 'tenant-signer', type: 'initials', page: 2, x: 50, y: 700, width: 50, height: 30 },
	]

	/**
	 * A converter that returns a real PDF plus its own signature map. On a
	 * layer with no slots (undeclared-field mode) core keeps that map.
	 */
	const createMockAdapter = (overrides?: { signatureMap?: SigningField[]; pdf?: Uint8Array }): SealAdapter => ({
		async convert() {
			return {
				pdf: overrides?.pdf ?? fixturePdf,
				signatureMap: overrides?.signatureMap ?? defaultSignatureMap(),
			}
		},
	})

	const sealOptions = (overrides?: { signatureMap?: SigningField[]; pdf?: Uint8Array }): SealOptions => ({
		adapter: createMockAdapter(overrides),
	})

	const createLandlordSigner = (): Signer => ({
		person: { name: 'John Landlord' },
	})

	const createTenantSigner = (): Signer => ({
		person: { name: 'Jane Tenant' },
	})

	/** Captures every required slot of the default mock adapter's signatureMap. */
	const captureDefaultSlots = <T extends SignableForm<any>>(sealed: T): T =>
		sealed
			.captureSignature('landlord', 'landlord-0', 'landlord-signer', 'sig-landlord-0')
			.captureSignature('tenant', 'tenant-0', 'tenant-signer', 'sig-tenant-0')
			.captureInitials('tenant', 'tenant-0', 'tenant-signer', 'initials-tenant-0') as T

	// ============================================================================
	// SignableForm.isFormal
	// ============================================================================

	describe('SignableForm.isFormal', () => {
		test('returns false when no signatureMap', () => {
			const formInstance = createFormWithSignature()
			const draft = formInstance.fill({
				fields: { rentAmount: 1500, moveInDate: '2024-01-01' },
				parties: {
					landlord: { id: 'landlord-0', name: 'John Landlord' },
					tenant: [{ id: 'tenant-0', name: 'Jane Tenant' }],
				},
			})
			const signable = draft.prepareForSigning()

			expect(signable.isFormal).toBe(false)
			expect(signable.signatureMap).toBeUndefined()
			expect(signable.canonicalPdfHash).toBeUndefined()
		})

		test('returns true when signatureMap and canonicalPdfHash are present', async () => {
			const formInstance = createFormWithSignature()
			const draft = formInstance
				.fill({
					fields: { rentAmount: 1500, moveInDate: '2024-01-01' },
					parties: {
						landlord: { id: 'landlord-0', name: 'John Landlord' },
						tenant: [{ id: 'tenant-0', name: 'Jane Tenant' }],
					},
				})
				.addSigner('landlord-signer', createLandlordSigner())
				.addSigner('tenant-signer', createTenantSigner())
				.addSignatory('landlord', 'landlord-0', { signerId: 'landlord-signer' })
				.addSignatory('tenant', 'tenant-0', { signerId: 'tenant-signer' })

			const formal = await draft.seal(sealOptions())

			expect(formal.isFormal).toBe(true)
			expect(formal.signatureMap).toBeDefined()
			expect(formal.signatureMap).toHaveLength(3)
			expect(formal.canonicalPdfHash).toBe(await expectedHash())
		})
	})

	// ============================================================================
	// SignableForm.getSignerForField
	// ============================================================================

	describe('SignableForm.getSignerForField', () => {
		test('returns undefined when form is not formal', () => {
			const formInstance = createFormWithSignature()
			const draft = formInstance.fill({
				fields: { rentAmount: 1500, moveInDate: '2024-01-01' },
				parties: {
					landlord: { id: 'landlord-0', name: 'John Landlord' },
					tenant: [{ id: 'tenant-0', name: 'Jane Tenant' }],
				},
			})
			const signable = draft.prepareForSigning()

			expect(signable.getSignerForField('sig-tenant-0')).toBeUndefined()
		})

		test('returns correct signer for valid field ID', async () => {
			const formInstance = createFormWithSignature()
			const draft = formInstance
				.fill({
					fields: { rentAmount: 1500, moveInDate: '2024-01-01' },
					parties: {
						landlord: { id: 'landlord-0', name: 'John Landlord' },
						tenant: [{ id: 'tenant-0', name: 'Jane Tenant' }],
					},
				})
				.addSigner('landlord-signer', createLandlordSigner())
				.addSigner('tenant-signer', createTenantSigner())
				.addSignatory('landlord', 'landlord-0', { signerId: 'landlord-signer' })
				.addSignatory('tenant', 'tenant-0', { signerId: 'tenant-signer' })

			const formal = await draft.seal(sealOptions())

			const landlordSigner = formal.getSignerForField('sig-landlord-0')
			expect(landlordSigner).toBeDefined()
			expect(landlordSigner?.person.name).toBe('John Landlord')

			const tenantSigner = formal.getSignerForField('sig-tenant-0')
			expect(tenantSigner).toBeDefined()
			expect(tenantSigner?.person.name).toBe('Jane Tenant')
		})

		test('returns undefined for invalid field ID', async () => {
			const formInstance = createFormWithSignature()
			const draft = formInstance
				.fill({
					fields: { rentAmount: 1500, moveInDate: '2024-01-01' },
					parties: {
						landlord: { id: 'landlord-0', name: 'John Landlord' },
						tenant: [{ id: 'tenant-0', name: 'Jane Tenant' }],
					},
				})
				.addSigner('landlord-signer', createLandlordSigner())
				.addSigner('tenant-signer', createTenantSigner())
				.addSignatory('landlord', 'landlord-0', { signerId: 'landlord-signer' })
				.addSignatory('tenant', 'tenant-0', { signerId: 'tenant-signer' })

			const formal = await draft.seal(sealOptions())

			expect(formal.getSignerForField('nonexistent-field')).toBeUndefined()
		})
	})

	// ============================================================================
	// SignableForm.getFieldsForSigner
	// ============================================================================

	describe('SignableForm.getFieldsForSigner', () => {
		test('returns empty array when form is not formal', () => {
			const formInstance = createFormWithSignature()
			const draft = formInstance.fill({
				fields: { rentAmount: 1500, moveInDate: '2024-01-01' },
				parties: {
					landlord: { id: 'landlord-0', name: 'John Landlord' },
					tenant: [{ id: 'tenant-0', name: 'Jane Tenant' }],
				},
			})
			const signable = draft.prepareForSigning()

			expect(signable.getFieldsForSigner('tenant-signer')).toEqual([])
		})

		test('returns correct fields for valid signer ID', async () => {
			const formInstance = createFormWithSignature()
			const draft = formInstance
				.fill({
					fields: { rentAmount: 1500, moveInDate: '2024-01-01' },
					parties: {
						landlord: { id: 'landlord-0', name: 'John Landlord' },
						tenant: [{ id: 'tenant-0', name: 'Jane Tenant' }],
					},
				})
				.addSigner('landlord-signer', createLandlordSigner())
				.addSigner('tenant-signer', createTenantSigner())
				.addSignatory('landlord', 'landlord-0', { signerId: 'landlord-signer' })
				.addSignatory('tenant', 'tenant-0', { signerId: 'tenant-signer' })

			const formal = await draft.seal(sealOptions())

			const landlordFields = formal.getFieldsForSigner('landlord-signer')
			expect(landlordFields).toHaveLength(1)
			expect(landlordFields[0]?.id).toBe('sig-landlord-0')
			expect(landlordFields[0]?.type).toBe('signature')

			const tenantFields = formal.getFieldsForSigner('tenant-signer')
			expect(tenantFields).toHaveLength(2)
			expect(tenantFields.map((f) => f.id)).toContain('sig-tenant-0')
			expect(tenantFields.map((f) => f.id)).toContain('initials-tenant-0')
		})

		test('returns empty array for invalid signer ID', async () => {
			const formInstance = createFormWithSignature()
			const draft = formInstance
				.fill({
					fields: { rentAmount: 1500, moveInDate: '2024-01-01' },
					parties: {
						landlord: { id: 'landlord-0', name: 'John Landlord' },
						tenant: [{ id: 'tenant-0', name: 'Jane Tenant' }],
					},
				})
				.addSigner('landlord-signer', createLandlordSigner())
				.addSigner('tenant-signer', createTenantSigner())
				.addSignatory('landlord', 'landlord-0', { signerId: 'landlord-signer' })
				.addSignatory('tenant', 'tenant-0', { signerId: 'tenant-signer' })

			const formal = await draft.seal(sealOptions())

			expect(formal.getFieldsForSigner('nonexistent-signer')).toEqual([])
		})
	})

	// ============================================================================
	// DraftForm.seal - Happy Path
	// ============================================================================

	describe('DraftForm.seal - Happy Path', () => {
		test('creates SignableForm with formal signing fields', async () => {
			const formInstance = createFormWithSignature()
			const draft = formInstance
				.fill({
					fields: { rentAmount: 1500, moveInDate: '2024-01-01' },
					parties: {
						landlord: { id: 'landlord-0', name: 'John Landlord' },
						tenant: [{ id: 'tenant-0', name: 'Jane Tenant' }],
					},
				})
				.addSigner('landlord-signer', createLandlordSigner())
				.addSigner('tenant-signer', createTenantSigner())
				.addSignatory('landlord', 'landlord-0', { signerId: 'landlord-signer' })
				.addSignatory('tenant', 'tenant-0', { signerId: 'tenant-signer' })

			const formal = await draft.seal(sealOptions())

			expect(formal).toHaveProperty('phase', 'signable')
			expect(formal.phase).toBe('signable')
			expect(formal.isFormal).toBe(true)
			expect(formal.signatureMap).toHaveLength(3)
			expect(formal.canonicalPdfHash).toBe(await expectedHash())

			// Verify original form data is preserved
			expect(formal.form.name).toBe('lease-agreement')
			expect(formal.getField('rentAmount')).toBe(1500)
			expect(formal.getParty('landlord')).toBeDefined()
		})

		test('canonicalizes the converted PDF: flattened bytes, hash of those bytes', async () => {
			const draft = createFormWithSignature()
				.fill({
					fields: { rentAmount: 1500, moveInDate: '2024-01-01' },
					parties: {
						landlord: { id: 'landlord-0', name: 'John Landlord' },
						tenant: [{ id: 'tenant-0', name: 'Jane Tenant' }],
					},
				})
				.addSigner('landlord-signer', createLandlordSigner())
				.addSigner('tenant-signer', createTenantSigner())
				.addSignatory('landlord', 'landlord-0', { signerId: 'landlord-signer' })
				.addSignatory('tenant', 'tenant-0', { signerId: 'tenant-signer' })

			const formal = await draft.seal(sealOptions())

			expect(formal.canonicalPdfBytes).toEqual(await flattenedFixture())
			expect(formal.canonicalPdfHash).toBe(await sha256Of(formal.canonicalPdfBytes!))
		})

		test('a different converted PDF yields a different hash', async () => {
			const draft = createFormWithSignature()
				.fill({
					fields: { rentAmount: 1500, moveInDate: '2024-01-01' },
					parties: {
						landlord: { id: 'landlord-0', name: 'John Landlord' },
						tenant: [{ id: 'tenant-0', name: 'Jane Tenant' }],
					},
				})
				.addSigner('landlord-signer', createLandlordSigner())
				.addSigner('tenant-signer', createTenantSigner())
				.addSignatory('landlord', 'landlord-0', { signerId: 'landlord-signer' })
				.addSignatory('tenant', 'tenant-0', { signerId: 'tenant-signer' })

			const other = new Uint8Array(readFileSync(join(__dirname, 'fixtures', 'auto-clean.pdf')))
			const [first, second] = await Promise.all([
				draft.seal(sealOptions()),
				draft.seal(sealOptions({ pdf: other })),
			])

			expect(second.canonicalPdfHash).toMatch(/^sha256:[a-f0-9]{64}$/)
			expect(second.canonicalPdfHash).not.toBe(first.canonicalPdfHash)
		})
	})

	// ============================================================================
	// setTargetLayer after seal
	// ============================================================================

	describe('setTargetLayer after seal', () => {
		const createTwoLayerForm = () =>
			form({
				kind: 'form',
				name: 'two-layer-lease',
				version: '1.0.0',
				title: 'Two-layer Lease',
				fields: { rentAmount: { type: 'number', label: 'Rent Amount', required: true } },
				parties: { landlord: { label: 'Landlord', partyType: 'person', signature: { required: true } } },
				layers: {
					text: { kind: 'inline', mimeType: 'text/plain', text: 'Layer A' },
					markdown: { kind: 'inline', mimeType: 'text/markdown', text: 'Layer B' },
				},
				defaultLayer: 'text',
			} as const)

		const buildDraft = () =>
			createTwoLayerForm()
				.fill({
					fields: { rentAmount: 1500 },
					parties: { landlord: { id: 'landlord-0', name: 'John Landlord' } },
				})
				.addSigner('landlord-signer', createLandlordSigner())
				.addSignatory('landlord', 'landlord-0', { signerId: 'landlord-signer' })

		test('refuses to retarget a sealed form, so no stale hash or map survives', async () => {
			const sealed = await buildDraft().seal(sealOptions())
			expect(sealed.canonicalPdfHash).toBe(await expectedHash())

			expect(() => sealed.setTargetLayer('markdown')).toThrow(
				'Cannot setTargetLayer: form is sealed on layer "text"',
			)
			expect(() => sealed.setTargetLayer('text')).toThrow('Cannot setTargetLayer: form is sealed')
			expect(sealed.targetLayer).toBe('text')
		})

		test('refuses to retarget an executed form', async () => {
			const landlordOnly = sealOptions({
				signatureMap: [
					{ id: 'sig-landlord-0', signerIndex: 0, signerId: 'landlord-signer', type: 'signature', page: 1, x: 100, y: 500, width: 200, height: 50 },
				],
			})
			const sealed = await buildDraft().seal(landlordOnly)
			const executed = sealed
				.captureSignature('landlord', 'landlord-0', 'landlord-signer', 'sig-landlord-0')
				.finalize()
			// ExecutedForm's type omits setTargetLayer; JS callers still reach the runtime method.
			const runtime = executed as unknown as { setTargetLayer(layer: string): unknown }
			expect(() => runtime.setTargetLayer('markdown')).toThrow(
				'Cannot setTargetLayer: form is in executed phase',
			)
		})

		test('still retargets a draft and an unsealed signable form', () => {
			const draft = buildDraft().setTargetLayer('markdown')
			expect(draft.targetLayer).toBe('markdown')

			const signable = buildDraft().prepareForSigning().setTargetLayer('markdown')
			expect(signable.phase).toBe('signable')
			expect(signable.targetLayer).toBe('markdown')
			expect(signable.canonicalPdfHash).toBeUndefined()
		})
	})

	// ============================================================================
	// DraftForm.seal - Validation Errors
	// ============================================================================

	describe('DraftForm.seal - Validation', () => {
		test('seals a PDF layer locally without an adapter', async () => {
			const pdf = Uint8Array.from(Buffer.from(
				'JVBERi0xLjUKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAzMDAgMzAwXSAvUmVzb3VyY2VzIDw8ID4+ID4+CmVuZG9iagp4cmVmCjAgNAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNCAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKMjAzCiUlRU9GCg==',
				'base64',
			))
			const formDef = form()
				.name('pdf-form')
				.version('1.0.0')
				.title('PDF Form')
				.fields({
					name: { type: 'text', label: 'Name' },
				})
				.parties({
					signer: {
						label: 'Signer',
						partyType: 'person',
						signature: { required: true },
					},
				})
				.fileLayer('pdf', {
					mimeType: 'application/pdf',
					path: '/forms/pdf-form.pdf',
					signatures: {
						'signer-signature': {
							party: { role: 'signer' },
							type: 'signature',
							placement: { page: 1, x: 50, y: 200, width: 120, height: 30 },
						},
					},
				})
				.defaultLayer('pdf')
				.build({ resolver: { read: async () => pdf } })

			const draft = formDef
				.fill({
					fields: { name: 'Test' },
					parties: { signer: { id: 'signer-0', name: 'Test Signer' } },
				})
				.addSigner('test-signer', { person: { name: 'Test Signer' } })
				.addSignatory('signer', 'signer-0', { signerId: 'test-signer' })

			const sealed = await draft.seal()

			expect(sealed.canonicalPdfBytes).toEqual(await flattenPdf(pdf))
			expect(sealed.canonicalPdfHash).toBe(await sha256Of(sealed.canonicalPdfBytes!))
			expect(sealed.signatureMap).toEqual([
				expect.objectContaining({ id: 'signer-signature', signerId: 'test-signer', page: 1, x: 50, y: 200, width: 120, height: 30 }),
			])
			expect(sealed.isFormal).toBe(true)
		})

		test('renders a non-PDF layer before passing it to the conversion adapter', async () => {
			const pdf = Uint8Array.from(Buffer.from(
				'JVBERi0xLjUKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAzMDAgMzAwXSAvUmVzb3VyY2VzIDw8ID4+ID4+CmVuZG9iagp4cmVmCjAgNAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNCAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKMjAzCiUlRU9GCg==',
				'base64',
			))
			let receivedMimeType: string | undefined
			let receivedContent: string | Uint8Array | undefined
			const adapter: SealAdapter = {
				async convert(request) {
					receivedMimeType = request.document.mimeType
					receivedContent = request.document.content
					return { pdf }
				},
			}
			const formDef = form()
				.name('markdown-form')
				.version('1.0.0')
				.title('Markdown Form')
				.fields({ name: { type: 'text', label: 'Name' } })
				.parties({ signer: { label: 'Signer', partyType: 'person', signature: { required: true } } })
				.inlineLayer('markdown', {
					mimeType: 'text/markdown',
					text: '# Hello {{fields.name}}',
					signatures: {
						'signer-signature': {
							party: { role: 'signer' },
							type: 'signature',
							placement: { page: 1, x: 50, y: 200, width: 120, height: 30 },
						},
					},
				})
				.defaultLayer('markdown')
				.build()
			const draft = formDef
				.fill({ fields: { name: 'Ada' }, parties: { signer: { id: 'signer-0', name: 'Ada' } } })
				.addSigner('ada', { person: { name: 'Ada' } })
				.addSignatory('signer', 'signer-0', { signerId: 'ada' })

			const sealed = await draft.seal({ adapter })

			expect(receivedMimeType).toBe('text/markdown')
			expect(receivedContent).toContain('# Hello Ada')
			expect(sealed.canonicalPdfBytes).toEqual(await flattenPdf(pdf))
			expect(sealed.canonicalPdfHash).toBe(await sha256Of(sealed.canonicalPdfBytes!))
		})

		test('uses a custom renderer before passing a non-PDF layer to the conversion adapter', async () => {
			const pdf = Uint8Array.from(Buffer.from(
				'JVBERi0xLjUKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAzMDAgMzAwXSAvUmVzb3VyY2VzIDw8ID4+ID4+CmVuZG9iagp4cmVmCjAgNAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNCAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKMjAzCiUlRU9GCg==',
				'base64',
			))
			let receivedContent: string | Uint8Array | undefined
			const adapter: SealAdapter = {
				async convert(request) {
					receivedContent = request.document.content
					return { pdf }
				},
			}
			const render = vi.fn(async () => '# Custom document')
			const formDef = form()
				.name('custom-rendered-form')
				.fields({ name: { type: 'text', label: 'Name' } })
				.parties({ signer: { label: 'Signer', partyType: 'person', signature: { required: true } } })
				.inlineLayer('markdown', {
					mimeType: 'text/markdown',
					text: '# Built-in {{fields.name}}',
					signatures: {
						signature: { party: { role: 'signer' }, type: 'signature', placement: { page: 1, x: 50, y: 200, width: 120, height: 30 } },
					},
				})
				.defaultLayer('markdown')
				.build()
			const draft = formDef
				.fill({ fields: { name: 'Ada' }, parties: { signer: { id: 'signer-0', name: 'Ada' } } })
				.addSigner('ada', { person: { name: 'Ada' } })
				.addSignatory('signer', 'signer-0', { signerId: 'ada' })

			const sealed = await draft.seal({
				adapter,
				renderer: { id: 'custom', render },
			})

			expect(render).toHaveBeenCalledOnce()
			expect(receivedContent).toBe('# Custom document')
			expect(sealed.canonicalPdfBytes).toEqual(await flattenPdf(pdf))
		})

		test('throws error when no parties exist', async () => {
			const formDef = form()
				.name('no-party-form')
				.version('1.0.0')
				.title('No Party Form')
				.fields({
					name: { type: 'text', label: 'Name' },
				})
				.inlineLayer('markdown', { mimeType: 'text/markdown', text: 'Template' })
				.defaultLayer('markdown')
				.build()

			const draft = formDef.fill({
				fields: { name: 'Test' },
			})

			await expect(draft.seal(sealOptions())).rejects.toThrow(
				/form has no parties/
			)
		})

		test('throws error when no required signatures exist', async () => {
			const formInstance = createFormWithoutSignature()
			const draft = formInstance
				.fill({
					fields: { name: 'Test' },
					parties: { applicant: { id: 'applicant-0', name: 'Test Applicant' } },
				})
				.addSigner('test-signer', { person: { name: 'Test Signer' } })
				.addSignatory('applicant', 'applicant-0', { signerId: 'test-signer' })

			await expect(draft.seal(sealOptions())).rejects.toThrow(
				/no party has a required signature/
			)
		})

		test('throws error when parties exist but no signatories configured', async () => {
			const formInstance = createFormWithSignature()
			const draft = formInstance.fill({
				fields: { rentAmount: 1500, moveInDate: '2024-01-01' },
				parties: {
					landlord: { id: 'landlord-0', name: 'John Landlord' },
					tenant: [{ id: 'tenant-0', name: 'Jane Tenant' }],
				},
			})
			// Note: No signers or signatories added

			await expect(draft.seal(sealOptions())).rejects.toThrow(
				/no party has a required signature/
			)
		})
	})

	// ============================================================================
	// Definition mode: required parties without signatories
	// ============================================================================

	describe('Slot seal with an unbound required party', () => {
		const slots = (tenantRequired?: boolean): Record<string, SignatureSlot> => ({
			'sb-landlord': {
				party: { role: 'landlord' },
				type: 'signature',
				placement: { page: 1, x: 50, y: 100, width: 120, height: 30 },
			},
			'sb-tenant': {
				party: { role: 'tenant' },
				type: 'signature',
				placement: { page: 1, x: 50, y: 200, width: 120, height: 30 },
				...(tenantRequired !== undefined && { required: tenantRequired }),
			},
		})

		const landlordOnlyDraft = (signatures: Record<string, SignatureSlot>) =>
			createFormWithSignature(signatures)
				.fill({
					fields: { rentAmount: 1500, moveInDate: '2024-01-01' },
					parties: {
						landlord: { id: 'landlord-0', name: 'John Landlord' },
						tenant: [{ id: 'tenant-0', name: 'Jane Tenant' }],
					},
				})
				.addSigner('landlord-signer', createLandlordSigner())
				.addSignatory('landlord', 'landlord-0', { signerId: 'landlord-signer' })

		test('rejects and names the required party instead of dropping its slot, before converting', async () => {
			const adapter = createMockAdapter()
			const convert = vi.spyOn(adapter, 'convert')
			const sealing = landlordOnlyDraft(slots()).seal({ adapter })

			await expect(sealing).rejects.toThrow(SealConfigError)
			await expect(sealing).rejects.toThrow(
				'Cannot seal: 1 required slot without signatories: slot "sb-tenant" (tenant[0]) has no signatory',
			)
			expect(convert).not.toHaveBeenCalled()
		})

		test('skips a slot marked required: false for an unbound party', async () => {
			const sealed = await landlordOnlyDraft(slots(false)).seal(sealOptions())
			expect(sealed.signatureMap?.map((field) => field.id)).toEqual(['sb-landlord'])
		})
	})

	// ============================================================================
	// Serialization Round-Trip
	// ============================================================================

	describe('Serialization round-trip', () => {
		test('toJSON preserves formal signing fields', async () => {
			const formInstance = createFormWithSignature()
			const draft = formInstance
				.fill({
					fields: { rentAmount: 1500, moveInDate: '2024-01-01' },
					parties: {
						landlord: { id: 'landlord-0', name: 'John Landlord' },
						tenant: [{ id: 'tenant-0', name: 'Jane Tenant' }],
					},
				})
				.addSigner('landlord-signer', createLandlordSigner())
				.addSigner('tenant-signer', createTenantSigner())
				.addSignatory('landlord', 'landlord-0', { signerId: 'landlord-signer' })
				.addSignatory('tenant', 'tenant-0', { signerId: 'tenant-signer' })

			const formal = await draft.seal(sealOptions())
			const json = formal.toJSON() as any

			expect(json.signatureMap).toBeDefined()
			expect(json.signatureMap).toHaveLength(3)
			expect(json.canonicalPdfHash).toBe(await expectedHash())
		})

		test('fromJSON restores formal signing fields', async () => {
			const formInstance = createFormWithSignature()
			const draft = formInstance
				.fill({
					fields: { rentAmount: 1500, moveInDate: '2024-01-01' },
					parties: {
						landlord: { id: 'landlord-0', name: 'John Landlord' },
						tenant: [{ id: 'tenant-0', name: 'Jane Tenant' }],
					},
				})
				.addSigner('landlord-signer', createLandlordSigner())
				.addSigner('tenant-signer', createTenantSigner())
				.addSignatory('landlord', 'landlord-0', { signerId: 'landlord-signer' })
				.addSignatory('tenant', 'tenant-0', { signerId: 'tenant-signer' })

			const formal = await draft.seal(sealOptions())
			const json = formal.toJSON()

			// Restore from JSON
			const restored = runtimeFormFromJSON(json)

			expect(restored.isFormal).toBe(true)
			expect(restored.signatureMap).toHaveLength(3)
			expect(restored.canonicalPdfHash).toBe(await expectedHash())

			// Verify helper methods work on restored form
			expect(restored.getSignerForField('sig-landlord-0')?.person.name).toBe('John Landlord')
			expect(restored.getFieldsForSigner('tenant-signer')).toHaveLength(2)
		})

		test('toJSON omits formal signing fields when not present', () => {
			const formInstance = createFormWithSignature()
			const draft = formInstance.fill({
				fields: { rentAmount: 1500, moveInDate: '2024-01-01' },
				parties: {
					landlord: { id: 'landlord-0', name: 'John Landlord' },
					tenant: [{ id: 'tenant-0', name: 'Jane Tenant' }],
				},
			})
			const signable = draft.prepareForSigning()
			const json = signable.toJSON() as any

			expect(json.signatureMap).toBeUndefined()
			expect(json.canonicalPdfHash).toBeUndefined()
		})

		test('YAML round-trip preserves formal signing fields', async () => {
			const formInstance = createFormWithSignature()
			const draft = formInstance
				.fill({
					fields: { rentAmount: 1500, moveInDate: '2024-01-01' },
					parties: {
						landlord: { id: 'landlord-0', name: 'John Landlord' },
						tenant: [{ id: 'tenant-0', name: 'Jane Tenant' }],
					},
				})
				.addSigner('landlord-signer', createLandlordSigner())
				.addSigner('tenant-signer', createTenantSigner())
				.addSignatory('landlord', 'landlord-0', { signerId: 'landlord-signer' })
				.addSignatory('tenant', 'tenant-0', { signerId: 'tenant-signer' })

			const formal = await draft.seal(sealOptions())
			const yaml = formal.toYAML()

			// Restore from YAML
			const parsed = fromYAML(yaml) as any
			const restored = runtimeFormFromJSON(parsed)

			expect(restored.isFormal).toBe(true)
			expect(restored.signatureMap).toHaveLength(3)
			expect(restored.canonicalPdfHash).toBe(await expectedHash())
		})

		const sealedDraft = () =>
			createFormWithSignature()
				.fill({
					fields: { rentAmount: 1500, moveInDate: '2024-01-01' },
					parties: {
						landlord: { id: 'landlord-0', name: 'John Landlord' },
						tenant: [{ id: 'tenant-0', name: 'Jane Tenant' }],
					},
				})
				.addSigner('landlord-signer', createLandlordSigner())
				.addSigner('tenant-signer', createTenantSigner())
				.addSignatory('landlord', 'landlord-0', { signerId: 'landlord-signer' })
				.addSignatory('tenant', 'tenant-0', { signerId: 'tenant-signer' })

		test('executed form JSON round-trip preserves signatureMap and canonicalPdfHash', async () => {
			const executed = captureDefaultSlots(await sealedDraft().seal(sealOptions())).finalize()
			expect(executed.isFormal).toBe(true)

			const json = executed.toJSON()
			expect(json.phase).toBe('executed')
			expect('signatureMap' in json && json.signatureMap).toEqual(executed.signatureMap)
			expect('canonicalPdfHash' in json && json.canonicalPdfHash).toBe(await expectedHash())

			const restored = runtimeFormFromJSON(json)
			expect(restored.phase).toBe('executed')
			expect(restored.isFormal).toBe(true)
			expect(restored.canonicalPdfHash).toBe(executed.canonicalPdfHash)
			expect(restored.signatureMap).toEqual(executed.signatureMap)
			expect(restored.executedAt).toBe(executed.executedAt)
			expect(restored.getSignerForField('sig-landlord-0')?.person.name).toBe('John Landlord')
			expect(restored.getFieldsForSigner('tenant-signer')).toHaveLength(2)
		})

		test('executed form YAML round-trip preserves signatureMap and canonicalPdfHash', async () => {
			const executed = captureDefaultSlots(await sealedDraft().seal(sealOptions())).finalize()

			const restored = runtimeFormFromJSON(fromYAML(executed.toYAML()) as any)
			expect(restored.phase).toBe('executed')
			expect(restored.isFormal).toBe(true)
			expect(restored.canonicalPdfHash).toBe(executed.canonicalPdfHash)
			expect(restored.signatureMap).toEqual(executed.signatureMap)
		})

		test('executed form JSON is a copy: mutating it leaves the form unchanged', async () => {
			const executed = captureDefaultSlots(await sealedDraft().seal(sealOptions())).finalize()
			const json = executed.toJSON() as any
			json.signatureMap[0].x = 999

			expect(executed.signatureMap?.[0]?.x).toBe(100)
		})

		test('unsealed executed form JSON omits formal signing fields and restores as not formal', () => {
			const executed = sealedDraft().prepareForSigning().finalize()
			expect(executed.isFormal).toBe(false)

			const json = executed.toJSON()
			expect('signatureMap' in json).toBe(false)
			expect('canonicalPdfHash' in json).toBe(false)

			const restored = runtimeFormFromJSON(json)
			expect(restored.phase).toBe('executed')
			expect(restored.isFormal).toBe(false)
			expect(restored.signatureMap).toBeUndefined()
			expect(restored.canonicalPdfHash).toBeUndefined()
		})

		test('canonicalPdfBytes are not serialized', async () => {
			const executed = (await sealedDraft().seal(sealOptions({ signatureMap: [] }))).finalize()
			expect(executed.canonicalPdfBytes).toEqual(await flattenedFixture())

			const json = executed.toJSON()
			expect('canonicalPdfBytes' in json).toBe(false)
			expect(runtimeFormFromJSON(json).canonicalPdfBytes).toBeUndefined()
		})

		const carriesBytes = (value: unknown): boolean =>
			value instanceof Uint8Array ||
			(typeof value === 'object' && value !== null && 'canonicalPdfBytes' in value)

		test('clone and transitions share the sealed bytes instead of copying them', async () => {
			const sealed = await sealedDraft().seal(sealOptions())
			const bytes = await flattenedFixture()

			const spy = vi.spyOn(globalThis, 'structuredClone')
			try {
				const cloned = sealed.clone()
				const captured = cloned.captureSignature('landlord', 'landlord-0', 'landlord-signer', 'sig-landlord-0')
				expect(spy.mock.calls.filter(([value]) => carriesBytes(value))).toEqual([])
				expect(captured.canonicalPdfBytes).toEqual(bytes)
				expect(cloned.canonicalPdfBytes).toEqual(bytes)
			} finally {
				spy.mockRestore()
			}
		})

		test('a clone stays independent of the original and of the converted PDF', async () => {
			const converted = fixturePdf.slice()
			const sealed = await sealedDraft().seal(sealOptions({ pdf: converted }))
			const original = sealed.canonicalPdfBytes!.slice()
			converted.fill(0)
			expect(sealed.canonicalPdfBytes).toEqual(original)

			const cloned = sealed.clone()
			expect(cloned.canonicalPdfBytes).not.toBe(sealed.canonicalPdfBytes)

			cloned.canonicalPdfBytes![1] = (original[1]! + 1) % 256
			const captured = cloned.captureSignature('landlord', 'landlord-0', 'landlord-signer', 'sig-landlord-0')
			expect(captured.captures).toHaveLength(1)
			expect(sealed.captures).toHaveLength(0)
			expect(sealed.canonicalPdfBytes).toEqual(original)
			expect(captured.canonicalPdfBytes).toEqual(original)
		})
	})

	// ============================================================================
	// Edge Cases
	// ============================================================================

	describe('Edge Cases', () => {
		test('SigningField with anchor positioning', async () => {
			const adapter = sealOptions({
				signatureMap: [
					{
						id: 'sig-anchor',
						signerIndex: 0,
						signerId: 'landlord-signer',
						type: 'signature',
						page: 1,
						x: 0,
						y: 0,
						width: 200,
						height: 50,
						anchor: {
							text: 'X_____________________',
							offsetX: 10,
							offsetY: -5,
						},
						required: true,
						label: 'Landlord Signature',
					},
				],
			})

			const formInstance = createFormWithSignature()
			const draft = formInstance
				.fill({
					fields: { rentAmount: 1500, moveInDate: '2024-01-01' },
					parties: {
						landlord: { id: 'landlord-0', name: 'John Landlord' },
						tenant: [{ id: 'tenant-0', name: 'Jane Tenant' }],
					},
				})
				.addSigner('landlord-signer', createLandlordSigner())
				.addSigner('tenant-signer', createTenantSigner())
				.addSignatory('landlord', 'landlord-0', { signerId: 'landlord-signer' })
				.addSignatory('tenant', 'tenant-0', { signerId: 'tenant-signer' })

			const formal = await draft.seal(adapter)

			expect(formal.signatureMap?.[0]?.anchor).toBeDefined()
			expect(formal.signatureMap?.[0]?.anchor?.text).toBe('X_____________________')
			expect(formal.signatureMap?.[0]?.required).toBe(true)
			expect(formal.signatureMap?.[0]?.label).toBe('Landlord Signature')
		})

		test('can clone formal SignableForm', async () => {
			const formInstance = createFormWithSignature()
			const draft = formInstance
				.fill({
					fields: { rentAmount: 1500, moveInDate: '2024-01-01' },
					parties: {
						landlord: { id: 'landlord-0', name: 'John Landlord' },
						tenant: [{ id: 'tenant-0', name: 'Jane Tenant' }],
					},
				})
				.addSigner('landlord-signer', createLandlordSigner())
				.addSigner('tenant-signer', createTenantSigner())
				.addSignatory('landlord', 'landlord-0', { signerId: 'landlord-signer' })
				.addSignatory('tenant', 'tenant-0', { signerId: 'tenant-signer' })

			const formal = await draft.seal(sealOptions())
			const cloned = formal.clone()

			expect(cloned.isFormal).toBe(true)
			expect(cloned.signatureMap).toHaveLength(3)
			expect(cloned.canonicalPdfHash).toBe(await expectedHash())

			// Verify it's a deep clone
			expect(cloned.signatureMap).not.toBe(formal.signatureMap)
		})
	})

	// ============================================================================
	// Capacity & Printed Name Captures
	// ============================================================================

	describe('Capacity & Printed Name captures', () => {
		const buildSignableForm = () =>
			createFormWithSignature()
				.fill({
					fields: { rentAmount: 1500, moveInDate: '2024-01-01' },
					parties: {
						landlord: { id: 'landlord-0', name: 'John Landlord' },
						tenant: [{ id: 'tenant-0', name: 'Jane Tenant' }],
					},
				})
				.addSigner('landlord-signer', createLandlordSigner())
				.addSigner('tenant-signer', createTenantSigner())
				.addSignatory('landlord', 'landlord-0', { signerId: 'landlord-signer' })
				.addSignatory('tenant', 'tenant-0', { signerId: 'tenant-signer' })
				.prepareForSigning()

		test('captureCapacity adds a capture with type capacity and text', () => {
			const signed = buildSignableForm().captureCapacity(
				'landlord',
				'landlord-0',
				'landlord-signer',
				'sb-cap',
				'President',
			)

			const capture = signed.getCapture('landlord', 'landlord-0', 'landlord-signer', 'sb-cap', 'capacity')
			expect(capture).toBeDefined()
			expect(capture?.type).toBe('capacity')
			expect(capture?.text).toBe('President')
			expect(capture?.image).toBeUndefined()
			expect(capture?.timestamp).toBeDefined()
		})

		test('capturePrintedName adds a capture with type printed_name and text', () => {
			const signed = buildSignableForm().capturePrintedName(
				'tenant',
				'tenant-0',
				'tenant-signer',
				'sb-print',
				'JANE A TENANT',
			)

			const capture = signed.getCapture('tenant', 'tenant-0', 'tenant-signer', 'sb-print', 'printed_name')
			expect(capture).toBeDefined()
			expect(capture?.type).toBe('printed_name')
			expect(capture?.text).toBe('JANE A TENANT')
			expect(capture?.image).toBeUndefined()
		})

		test('captureCapacity respects custom timestamp and method', () => {
			const ts = '2024-06-01T12:00:00.000Z'
			const signed = buildSignableForm().captureCapacity(
				'landlord',
				'landlord-0',
				'landlord-signer',
				'sb-cap',
				'Trustee',
				{ timestamp: ts, method: 'typed' },
			)

			const capture = signed.getCapture('landlord', 'landlord-0', 'landlord-signer', 'sb-cap', 'capacity')
			expect(capture?.timestamp).toBe(ts)
			expect(capture?.method).toBe('typed')
		})

		test('getCapture distinguishes capacity from signature at the same locationId', () => {
			const signed = buildSignableForm()
				.captureSignature('landlord', 'landlord-0', 'landlord-signer', 'sb-shared')
				.captureCapacity('landlord', 'landlord-0', 'landlord-signer', 'sb-shared', 'CEO')

			const sig = signed.getCapture('landlord', 'landlord-0', 'landlord-signer', 'sb-shared', 'signature')
			const cap = signed.getCapture('landlord', 'landlord-0', 'landlord-signer', 'sb-shared', 'capacity')

			expect(sig?.type).toBe('signature')
			expect(cap?.type).toBe('capacity')
			expect(cap?.text).toBe('CEO')
		})

		test('captureCapacity throws when signerId is unknown', () => {
			expect(() =>
				buildSignableForm().captureCapacity('landlord', 'landlord-0', 'unknown-signer', 'sb-cap', 'President'),
			).toThrow(/Signer with ID "unknown-signer" not found/)
		})
	})

	// ============================================================================
	// Capture slot validation
	// ============================================================================

	describe('Capture slot validation', () => {
		const buildDraft = () =>
			createFormWithSignature()
				.fill({
					fields: { rentAmount: 1500, moveInDate: '2024-01-01' },
					parties: {
						landlord: { id: 'landlord-0', name: 'John Landlord' },
						tenant: [{ id: 'tenant-0', name: 'Jane Tenant' }],
					},
				})
				.addSigner('landlord-signer', createLandlordSigner())
				.addSigner('tenant-signer', createTenantSigner())
				.addSignatory('landlord', 'landlord-0', { signerId: 'landlord-signer' })
				.addSignatory('tenant', 'tenant-0', { signerId: 'tenant-signer' })

		const sealWithAllTypes = () =>
			buildDraft().seal(
				sealOptions({
					signatureMap: [
						{ id: 'sig-landlord-0', signerIndex: 0, signerId: 'landlord-signer', type: 'signature', page: 1, x: 0, y: 0, width: 200, height: 50 },
						{ id: 'cap-landlord-0', signerIndex: 0, signerId: 'landlord-signer', type: 'capacity', page: 1, x: 0, y: 60, width: 200, height: 20 },
						{ id: 'name-tenant-0', signerIndex: 1, signerId: 'tenant-signer', type: 'printed_name', page: 1, x: 0, y: 90, width: 200, height: 20 },
						{ id: 'initials-tenant-0', signerIndex: 1, signerId: 'tenant-signer', type: 'initials', page: 2, x: 0, y: 0, width: 50, height: 30 },
					],
				}),
			)

		test('formal form accepts each capture type at its matching slot', async () => {
			const formal = await sealWithAllTypes()
			const signed = formal
				.captureSignature('landlord', 'landlord-0', 'landlord-signer', 'sig-landlord-0')
				.captureCapacity('landlord', 'landlord-0', 'landlord-signer', 'cap-landlord-0', 'Owner')
				.capturePrintedName('tenant', 'tenant-0', 'tenant-signer', 'name-tenant-0', 'JANE TENANT')
				.captureInitials('tenant', 'tenant-0', 'tenant-signer', 'initials-tenant-0')

			expect(signed.getCapture('landlord', 'landlord-0', 'landlord-signer', 'sig-landlord-0', 'signature')).toBeDefined()
			expect(signed.getCapture('landlord', 'landlord-0', 'landlord-signer', 'cap-landlord-0', 'capacity')?.text).toBe('Owner')
			expect(signed.getCapture('tenant', 'tenant-0', 'tenant-signer', 'name-tenant-0', 'printed_name')?.text).toBe('JANE TENANT')
			expect(signed.getCapture('tenant', 'tenant-0', 'tenant-signer', 'initials-tenant-0', 'initials')).toBeDefined()
		})

		test('formal form rejects a locationId absent from signatureMap for every capture method', async () => {
			const formal = await sealWithAllTypes()
			expect(() => formal.captureSignature('landlord', 'landlord-0', 'landlord-signer', 'bogus-slot'))
				.toThrow('Cannot captureSignature: location "bogus-slot" not found in signatureMap')
			expect(() => formal.captureInitials('tenant', 'tenant-0', 'tenant-signer', 'bogus-slot'))
				.toThrow('Cannot captureInitials: location "bogus-slot" not found in signatureMap')
			expect(() => formal.captureCapacity('landlord', 'landlord-0', 'landlord-signer', 'bogus-slot', 'Owner'))
				.toThrow('Cannot captureCapacity: location "bogus-slot" not found in signatureMap')
			expect(() => formal.capturePrintedName('tenant', 'tenant-0', 'tenant-signer', 'bogus-slot', 'JANE'))
				.toThrow('Cannot capturePrintedName: location "bogus-slot" not found in signatureMap')
		})

		test('formal form rejects a slot that belongs to another signer', async () => {
			const formal = await sealWithAllTypes()
			expect(() => formal.captureInitials('landlord', 'landlord-0', 'landlord-signer', 'initials-tenant-0'))
				.toThrow('Cannot captureInitials: location "initials-tenant-0" belongs to signer "tenant-signer", not "landlord-signer"')
		})

		test('formal form rejects a capture whose type does not match the slot type', async () => {
			const formal = await sealWithAllTypes()
			expect(() => formal.captureInitials('landlord', 'landlord-0', 'landlord-signer', 'sig-landlord-0'))
				.toThrow('Cannot captureInitials: location "sig-landlord-0" is a signature field, not initials')
			expect(() => formal.capturePrintedName('landlord', 'landlord-0', 'landlord-signer', 'cap-landlord-0', 'JOHN'))
				.toThrow('Cannot capturePrintedName: location "cap-landlord-0" is a capacity field, not printed_name')
		})

		test('rejects an unknown role on formal and informal forms', async () => {
			const formal = await sealWithAllTypes()
			const informal = buildDraft().prepareForSigning()
			for (const signable of [formal, informal]) {
				expect(() => signable.captureSignature('NOT_A_ROLE', 'landlord-0', 'landlord-signer', 'sig-landlord-0'))
					.toThrow('Role "NOT_A_ROLE" not found in form. Valid roles: landlord, tenant')
			}
		})

		test('rejects an unknown partyId on formal and informal forms', async () => {
			const formal = await sealWithAllTypes()
			const informal = buildDraft().prepareForSigning()
			for (const signable of [formal, informal]) {
				expect(() => signable.captureCapacity('landlord', 'landlord-9', 'landlord-signer', 'cap-landlord-0', 'Owner'))
					.toThrow('Cannot captureCapacity: party "landlord-9" not found for role "landlord"')
			}
		})

		test('rejects a signer who is not a signatory for the party', async () => {
			const formal = await sealWithAllTypes()
			const informal = buildDraft().prepareForSigning()
			for (const signable of [formal, informal]) {
				expect(() => signable.captureSignature('landlord', 'landlord-0', 'tenant-signer', 'sig-landlord-0'))
					.toThrow('Cannot captureSignature: signer "tenant-signer" is not a signatory for party "landlord-0" in role "landlord"')
			}
		})

		test('informal form without a signatureMap accepts any locationId for a bound signatory', () => {
			const signed = buildDraft().prepareForSigning()
				.capturePrintedName('tenant', 'tenant-0', 'tenant-signer', 'any-location', 'JANE')
			expect(signed.getCapture('tenant', 'tenant-0', 'tenant-signer', 'any-location', 'printed_name')?.text).toBe('JANE')
		})

		test('rejects a second capture of the same slot for every capture method', async () => {
			const signed = (await sealWithAllTypes())
				.captureSignature('landlord', 'landlord-0', 'landlord-signer', 'sig-landlord-0', { image: 'FIRST' })
				.captureCapacity('landlord', 'landlord-0', 'landlord-signer', 'cap-landlord-0', 'Owner')
				.capturePrintedName('tenant', 'tenant-0', 'tenant-signer', 'name-tenant-0', 'JANE TENANT')
				.captureInitials('tenant', 'tenant-0', 'tenant-signer', 'initials-tenant-0')

			expect(() => signed.captureSignature('landlord', 'landlord-0', 'landlord-signer', 'sig-landlord-0', { image: 'SECOND' }))
				.toThrow('Cannot captureSignature: location "sig-landlord-0" already has a signature capture for signer "landlord-signer"')
			expect(() => signed.captureCapacity('landlord', 'landlord-0', 'landlord-signer', 'cap-landlord-0', 'Agent'))
				.toThrow('Cannot captureCapacity: location "cap-landlord-0" already has a capacity capture for signer "landlord-signer"')
			expect(() => signed.capturePrintedName('tenant', 'tenant-0', 'tenant-signer', 'name-tenant-0', 'J. TENANT'))
				.toThrow('Cannot capturePrintedName: location "name-tenant-0" already has a printed_name capture for signer "tenant-signer"')
			expect(() => signed.captureInitials('tenant', 'tenant-0', 'tenant-signer', 'initials-tenant-0'))
				.toThrow('Cannot captureInitials: location "initials-tenant-0" already has a initials capture for signer "tenant-signer"')
			expect(signed.getCapturesForLocation('sig-landlord-0')).toHaveLength(1)
			expect(signed.getCapture('landlord', 'landlord-0', 'landlord-signer', 'sig-landlord-0', 'signature')?.image).toBe('FIRST')
		})

		test('an informal form also rejects a second capture of the same slot', () => {
			const signed = buildDraft().prepareForSigning()
				.captureSignature('tenant', 'tenant-0', 'tenant-signer', 'any-location')
			expect(() => signed.captureSignature('tenant', 'tenant-0', 'tenant-signer', 'any-location'))
				.toThrow('Cannot captureSignature: location "any-location" already has a signature capture for signer "tenant-signer"')
			// A different capture type at the same location is a different slot.
			const withName = signed.capturePrintedName('tenant', 'tenant-0', 'tenant-signer', 'any-location', 'JANE')
			expect(withName.getCapturesForLocation('any-location')).toHaveLength(2)
		})

		test('a capture is corrected by capturing again from the earlier form instance', async () => {
			const formal = await sealWithAllTypes()
			formal.captureSignature('landlord', 'landlord-0', 'landlord-signer', 'sig-landlord-0', { image: 'FIRST' })
			const corrected = formal.captureSignature('landlord', 'landlord-0', 'landlord-signer', 'sig-landlord-0', { image: 'SECOND' })
			expect(corrected.getCapture('landlord', 'landlord-0', 'landlord-signer', 'sig-landlord-0', 'signature')?.image).toBe('SECOND')
		})
	})

	describe('Finalize completeness', () => {
		const buildDraft = () =>
			createFormWithSignature()
				.fill({
					fields: { rentAmount: 1500, moveInDate: '2024-01-01' },
					parties: {
						landlord: { id: 'landlord-0', name: 'John Landlord' },
						tenant: [{ id: 'tenant-0', name: 'Jane Tenant' }],
					},
				})
				.addSigner('landlord-signer', createLandlordSigner())
				.addSigner('tenant-signer', createTenantSigner())
				.addSignatory('landlord', 'landlord-0', { signerId: 'landlord-signer' })
				.addSignatory('tenant', 'tenant-0', { signerId: 'tenant-signer' })

		test('refuses to finalize a formal form with no captures, listing every missing slot', async () => {
			const formal = await buildDraft().seal(sealOptions())
			expect(() => formal.finalize()).toThrow(
				'Cannot finalize: required signing slots have no capture: ' +
					'"sig-landlord-0" (signature, signer "landlord-signer"), ' +
					'"sig-tenant-0" (signature, signer "tenant-signer"), ' +
					'"initials-tenant-0" (initials, signer "tenant-signer")',
			)
		})

		test('lists only the slots that are still missing', async () => {
			const partial = (await buildDraft().seal(sealOptions()))
				.captureSignature('landlord', 'landlord-0', 'landlord-signer', 'sig-landlord-0')
				.captureSignature('tenant', 'tenant-0', 'tenant-signer', 'sig-tenant-0')
			expect(() => partial.finalize()).toThrow(
				'Cannot finalize: required signing slots have no capture: "initials-tenant-0" (initials, signer "tenant-signer")',
			)
		})

		test('finalizes a formal form once every required slot is captured', async () => {
			const executed = captureDefaultSlots(await buildDraft().seal(sealOptions())).finalize()
			expect(executed.phase).toBe('executed')
			expect(executed.captures).toHaveLength(3)
		})

		test('skips slots marked required: false and date_signed slots', async () => {
			const formal = await buildDraft().seal(
				sealOptions({
					signatureMap: [
						{ id: 'sig-landlord-0', signerIndex: 0, signerId: 'landlord-signer', type: 'signature', page: 1, x: 0, y: 0, width: 200, height: 50 },
						{ id: 'date-landlord-0', signerIndex: 0, signerId: 'landlord-signer', type: 'date_signed', page: 1, x: 0, y: 60, width: 100, height: 20 },
						{ id: 'initials-tenant-0', signerIndex: 1, signerId: 'tenant-signer', type: 'initials', page: 2, x: 0, y: 0, width: 50, height: 30, required: false },
					],
				}),
			)
			expect(() => formal.finalize()).toThrow(
				'Cannot finalize: required signing slots have no capture: "sig-landlord-0" (signature, signer "landlord-signer")',
			)
			const executed = formal.captureSignature('landlord', 'landlord-0', 'landlord-signer', 'sig-landlord-0').finalize()
			expect(executed.phase).toBe('executed')
		})

		test('a formal form sealed with an empty signatureMap finalizes', async () => {
			const formal = await buildDraft().seal(sealOptions({ signatureMap: [] }))
			expect(formal.isFormal).toBe(true)
			expect(formal.finalize().phase).toBe('executed')
		})
	})

	// ============================================================================
	// Slot → SigningField pass-through for every slot type
	// ============================================================================

	describe('Slot seal pass-through for every slot type', () => {
		const slot = (
			type: SignatureSlot['type'],
			y: number,
			label: string,
			role: 'landlord' | 'tenant' = 'landlord',
		): SignatureSlot => ({
			party: { role },
			type,
			label,
			placement: { page: 1, x: 100, y, width: 200, height: 14 },
		})

		const slots: Record<string, SignatureSlot> = {
			'sb-landlord-sig': slot('signature', 500, 'Landlord signature'),
			'sb-landlord-cap': slot('capacity', 540, 'Landlord capacity'),
			'sb-landlord-print': slot('printed_name', 560, 'Landlord printed name'),
			'sb-landlord-date': slot('date_signed', 580, 'Date'),
			'sb-tenant-sig': slot('signature', 620, 'Tenant signature', 'tenant'),
		}

		const buildDraft = () =>
			createFormWithSignature(slots)
				.fill({
					fields: { rentAmount: 1500, moveInDate: '2024-01-01' },
					parties: {
						landlord: { id: 'landlord-0', name: 'John Landlord' },
						tenant: [{ id: 'tenant-0', name: 'Jane Tenant' }],
					},
				})
				.addSigner('landlord-signer', createLandlordSigner())
				.addSigner('tenant-signer', createTenantSigner())
				.addSignatory('landlord', 'landlord-0', { signerId: 'landlord-signer', capacity: 'President' })
				.addSignatory('tenant', 'tenant-0', { signerId: 'tenant-signer' })

		test('each slot becomes a SigningField with its type, label, and signer', async () => {
			const formal = await buildDraft().seal(sealOptions())

			expect(formal.signatureMap?.map((field) => [field.id, field.type, field.label, field.signerId])).toEqual([
				['sb-landlord-sig', 'signature', 'Landlord signature', 'landlord-signer'],
				['sb-landlord-cap', 'capacity', 'Landlord capacity', 'landlord-signer'],
				['sb-landlord-print', 'printed_name', 'Landlord printed name', 'landlord-signer'],
				['sb-landlord-date', 'date_signed', 'Date', 'landlord-signer'],
				['sb-tenant-sig', 'signature', 'Tenant signature', 'tenant-signer'],
			])
		})
	})

	// ============================================================================
	// Anchor placement: SigningField placement from anchor slots
	// ============================================================================

	describe('Anchor placement seal', () => {
		const anchorSlots: Record<string, SignatureSlot> = {
			'anc-landlord-sig': {
				party: { role: 'landlord' },
				type: 'signature',
				placement: { anchor: { text: 'LANDLORD SIGNATURE:', offsetX: 0, offsetY: 10 }, width: 200, height: 40 },
				label: 'Landlord signature',
				required: true,
			},
			'anc-tenant-sig': {
				party: { role: 'tenant' },
				type: 'signature',
				placement: { anchor: { text: 'TENANT SIGNATURE:', offsetX: 0, offsetY: 10 }, width: 200, height: 40 },
				label: 'Tenant signature',
			},
		}

		const createFormWithAnchorSlots = () =>
			form()
				.name('anchor-lease')
				.version('1.0.0')
				.title('Anchor Lease Agreement')
				.fields({
					rentAmount: { type: 'number', label: 'Rent Amount', required: true },
				})
				.parties({
					landlord: {
						label: 'Landlord',
						partyType: 'person',
						signature: { required: true },
					},
					tenant: {
						label: 'Tenant',
						partyType: 'person',
						signature: { required: true },
					},
				})
				.inlineLayer('markdown', {
					mimeType: 'text/markdown',
					text: 'LANDLORD SIGNATURE:\n\n\nTENANT SIGNATURE:\n\n',
					signatures: anchorSlots,
				})
				.defaultLayer('markdown')
				.build()

		/**
		 * A converter that returns a real PDF, plus a locator stub that resolves
		 * anchor text to fixed positions (the fixture PDF has no such text).
		 */
		const anchorPositions: Record<string, { page: number; x: number; y: number }> = {
			'LANDLORD SIGNATURE:': { page: 1, x: 72, y: 300 },
			'TENANT SIGNATURE:': { page: 1, x: 72, y: 400 },
		}
		const createAnchorOptions = () => {
			const requests: SealAdapterRequest[] = []
			const located: Uint8Array[] = []
			const adapter: SealAdapter = {
				async convert(request) {
					requests.push(request)
					return { pdf: fixturePdf }
				},
			}
			const locate: SealLocator = {
				async locate(pdf, queries) {
					located.push(pdf)
					return queries.map((query) => ({ id: query.id, ...anchorPositions[query.text]!, width: 0, height: 0 }))
				},
			}
			return { options: { adapter, locate } satisfies SealOptions, requests, located }
		}

		const fillAnchorForm = () =>
			createFormWithAnchorSlots()
				.fill({
					fields: { rentAmount: 1200 },
					parties: {
						landlord: { id: 'landlord-0', name: 'John Landlord' },
						tenant: { id: 'tenant-0', name: 'Jane Tenant' },
					},
				})
				.addSigner('landlord-signer', { person: { name: 'John Landlord' } })
				.addSignatory('landlord', 'landlord-0', { signerId: 'landlord-signer' })

		const buildAnchorDraft = () =>
			fillAnchorForm()
				.addSigner('tenant-signer', { person: { name: 'Jane Tenant' } })
				.addSignatory('tenant', 'tenant-0', { signerId: 'tenant-signer' })

		test('rejects and names a required party with no signatory instead of dropping its anchor', async () => {
			const { options, requests } = createAnchorOptions()
			const sealing = fillAnchorForm().seal(options)

			await expect(sealing).rejects.toThrow(SealConfigError)
			await expect(sealing).rejects.toThrow('slot "anc-tenant-sig" (tenant[0]) has no signatory')
			expect(requests).toEqual([])
		})

		test('passes anchorFields to the adapter with correct signer bindings', async () => {
			const { options, requests } = createAnchorOptions()
			await buildAnchorDraft().seal(options)

			expect(requests).toHaveLength(1)
			const anchorFields = requests[0]!.anchorFields
			expect(anchorFields).toHaveLength(2)

			const landlordField = anchorFields?.find((f) => f.id === 'anc-landlord-sig')
			expect(landlordField?.signerId).toBe('landlord-signer')
			expect(landlordField?.type).toBe('signature')
			expect(landlordField?.anchor?.text).toBe('LANDLORD SIGNATURE:')
			expect(landlordField?.anchor?.offsetX).toBe(0)
			expect(landlordField?.anchor?.offsetY).toBe(10)
			expect(landlordField?.width).toBe(200)
			expect(landlordField?.height).toBe(40)
			expect(landlordField?.required).toBe(true)
			expect(landlordField?.label).toBe('Landlord signature')

			const tenantField = anchorFields?.find((f) => f.id === 'anc-tenant-sig')
			expect(tenantField?.signerId).toBe('tenant-signer')
			expect(tenantField?.anchor?.text).toBe('TENANT SIGNATURE:')
		})

		test('resolves anchors on the canonical PDF and applies the declared offsets', async () => {
			const { options, located } = createAnchorOptions()
			const formal = await buildAnchorDraft().seal(options)

			// The locator reads the same bytes the hash covers.
			expect(located).toEqual([formal.canonicalPdfBytes])
			expect(formal.canonicalPdfHash).toBe(await expectedHash())
			expect(formal.signatureMap).toHaveLength(2)

			const landlordField = formal.signatureMap?.find((f) => f.id === 'anc-landlord-sig')
			expect(landlordField?.page).toBe(1)
			expect(landlordField?.x).toBe(72)   // anchor x + offsetX (0)
			expect(landlordField?.y).toBe(310)  // anchor y + offsetY (10)
			expect(landlordField?.width).toBe(200)
			expect(landlordField?.height).toBe(40)
			expect(landlordField?.signerId).toBe('landlord-signer')
			expect(landlordField?.anchor?.text).toBe('LANDLORD SIGNATURE:')

			const tenantField = formal.signatureMap?.find((f) => f.id === 'anc-tenant-sig')
			expect(tenantField?.page).toBe(1)
			expect(tenantField?.x).toBe(72)
			expect(tenantField?.y).toBe(410)    // 400 + 10
			expect(tenantField?.signerId).toBe('tenant-signer')
		})

		test('fails loud when the locator leaves an anchor unresolved', async () => {
			const { options } = createAnchorOptions()
			const partial: SealLocator = {
				async locate(pdf, queries) {
					return (await options.locate.locate(pdf, queries)).filter((hit) => hit.id !== 'anc-tenant-sig')
				},
			}
			await expect(buildAnchorDraft().seal({ ...options, locate: partial })).rejects.toThrow(
				'Locator did not resolve anchor slot "anc-tenant-sig".',
			)
		})
	})

	test('a non-PDF layer with no slots requires an adapter', async () => {
		const formDef = form()
			.name('no-slots-markdown')
			.version('1.0.0')
			.title('No Slots Markdown')
			.fields({ name: { type: 'text', label: 'Name' } })
			.parties({
				signer: { label: 'Signer', partyType: 'person', signature: { required: true } },
			})
			.inlineLayer('markdown', { mimeType: 'text/markdown', text: 'Markdown content' })
			.defaultLayer('markdown')
			.build()

		const draft = formDef
			.fill({ fields: { name: 'Test' }, parties: { signer: { id: 'signer-0', name: 'Signer' } } })
			.addSigner('s-sig', { person: { name: 'Signer' } })
			.addSignatory('signer', 'signer-0', { signerId: 's-sig' })

		await expect(draft.seal()).rejects.toThrow(/Cannot seal .* without an adapter/)
	})
})
