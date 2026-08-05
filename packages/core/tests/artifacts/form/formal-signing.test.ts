import { describe, test, expect } from 'vitest'
import { form, runtimeFormFromJSON } from '@/artifacts'
import type { DraftForm, SignableForm } from '@/artifacts'
import type { SealAdapter, Sealer, SigningField, Signer, SignatureBlock, AnchorBlock } from '@paradoc/types'
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

	const createFormWithSignature = (signatureBlocks?: Record<string, SignatureBlock>) =>
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
					types: ['person', 'organization'],
					signature: { required: true },
				},
				tenant: {
					label: 'Tenant',
					types: ['person'],
					min: 1,
					max: 4,
					signature: { required: true },
				},
			})
			.inlineLayer('docx', {
				mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
				text: 'Lease template',
				...(signatureBlocks && { signatureBlocks }),
			})
			.defaultLayer('docx')
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
					types: ['person'],
					// No signature required
				},
			})
			.inlineLayer('docx', { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', text: 'Simple template' })
			.defaultLayer('docx')
			.build()

	const createMockAdapter = (overrides?: Partial<{
		signatureMap: SigningField[]
		canonicalPdfHash: string
		canonicalPdfUrl: string
	}>): Sealer => ({
		async seal() {
			return {
				signatureMap: overrides?.signatureMap ?? [
					{
						id: 'sig-landlord-0',
						signerIndex: 0,
						signerId: 'landlord-signer',
						type: 'signature',
						page: 1,
						x: 100,
						y: 500,
						width: 200,
						height: 50,
					},
					{
						id: 'sig-tenant-0',
						signerIndex: 1,
						signerId: 'tenant-signer',
						type: 'signature',
						page: 1,
						x: 100,
						y: 600,
						width: 200,
						height: 50,
					},
					{
						id: 'initials-tenant-0',
						signerIndex: 1,
						signerId: 'tenant-signer',
						type: 'initials',
						page: 2,
						x: 50,
						y: 700,
						width: 50,
						height: 30,
					},
				],
				canonicalPdfHash: overrides?.canonicalPdfHash ?? 'sha256:abc123def456',
				...(overrides?.canonicalPdfUrl && { canonicalPdfUrl: overrides.canonicalPdfUrl }),
			}
		},
	})

	const createLandlordSigner = (): Signer => ({
		person: { name: 'John Landlord' },
	})

	const createTenantSigner = (): Signer => ({
		person: { name: 'Jane Tenant' },
	})

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

			const formal = await draft.seal(createMockAdapter())

			expect(formal.isFormal).toBe(true)
			expect(formal.signatureMap).toBeDefined()
			expect(formal.signatureMap).toHaveLength(3)
			expect(formal.canonicalPdfHash).toBe('sha256:abc123def456')
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

			const formal = await draft.seal(createMockAdapter())

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

			const formal = await draft.seal(createMockAdapter())

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

			const formal = await draft.seal(createMockAdapter())

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

			const formal = await draft.seal(createMockAdapter())

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

			const formal = await draft.seal(createMockAdapter())

			expect(formal).toHaveProperty('phase', 'signable')
			expect(formal.phase).toBe('signable')
			expect(formal.isFormal).toBe(true)
			expect(formal.signatureMap).toHaveLength(3)
			expect(formal.canonicalPdfHash).toBe('sha256:abc123def456')

			// Verify original form data is preserved
			expect(formal.form.name).toBe('lease-agreement')
			expect(formal.getField('rentAmount')).toBe(1500)
			expect(formal.getParty('landlord')).toBeDefined()
		})

		test('includes canonicalPdfUrl when adapter provides it', async () => {
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

			const adapter = createMockAdapter({
				canonicalPdfUrl: 'https://storage.example.com/forms/abc123.pdf',
			})
			const formal = await draft.seal(adapter)

			expect(formal.signatureMap).toBeDefined()
			expect(formal.canonicalPdfHash).toBeDefined()
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
						types: ['person'],
						signature: { required: true },
					},
				})
				.fileLayer('pdf', {
					mimeType: 'application/pdf',
					path: '/forms/pdf-form.pdf',
					signatureBlocks: {
						'signer-signature': {
							type: 'signature', page: 1, x: 50, y: 200, width: 120, height: 30, partyRole: 'signer',
						},
					},
				})
				.defaultLayer('pdf')
				.build()

			const draft = formDef
				.fill({
					fields: { name: 'Test' },
					parties: { signer: { id: 'signer-0', name: 'Test Signer' } },
				})
				.addSigner('test-signer', { person: { name: 'Test Signer' } })
				.addSignatory('signer', 'signer-0', { signerId: 'test-signer' })

			const sealed = await draft.seal({ resolver: { read: async () => pdf } })

			expect(sealed.canonicalPdfBytes).toEqual(pdf)
			expect(sealed.canonicalPdfHash).toMatch(/^sha256:[a-f0-9]{64}$/)
			expect(sealed.signatureMap).toHaveLength(1)
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
				.parties({ signer: { label: 'Signer', types: ['person'], signature: { required: true } } })
				.inlineLayer('markdown', {
					mimeType: 'text/markdown',
					text: '# Hello {{name}}',
					signatureBlocks: {
						'signer-signature': {
							type: 'signature', page: 1, x: 50, y: 200, width: 120, height: 30, partyRole: 'signer',
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
			expect(sealed.canonicalPdfBytes).toEqual(pdf)
			expect(sealed.canonicalPdfHash).toMatch(/^sha256:[a-f0-9]{64}$/)
		})

		test('throws error when no parties exist', async () => {
			const formDef = form()
				.name('no-party-form')
				.version('1.0.0')
				.title('No Party Form')
				.fields({
					name: { type: 'text', label: 'Name' },
				})
				.inlineLayer('docx', { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', text: 'Template' })
				.defaultLayer('docx')
				.build()

			const draft = formDef.fill({
				fields: { name: 'Test' },
			})

			await expect(draft.seal(createMockAdapter())).rejects.toThrow(
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

			await expect(draft.seal(createMockAdapter())).rejects.toThrow(
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

			await expect(draft.seal(createMockAdapter())).rejects.toThrow(
				/no party has a required signature/
			)
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

			const formal = await draft.seal(createMockAdapter())
			const json = formal.toJSON() as any

			expect(json.signatureMap).toBeDefined()
			expect(json.signatureMap).toHaveLength(3)
			expect(json.canonicalPdfHash).toBe('sha256:abc123def456')
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

			const formal = await draft.seal(createMockAdapter())
			const json = formal.toJSON()

			// Restore from JSON
			const restored = runtimeFormFromJSON(json)

			expect(restored.isFormal).toBe(true)
			expect(restored.signatureMap).toHaveLength(3)
			expect(restored.canonicalPdfHash).toBe('sha256:abc123def456')

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

			const formal = await draft.seal(createMockAdapter())
			const yaml = formal.toYAML()

			// Restore from YAML
			const parsed = fromYAML(yaml) as any
			const restored = runtimeFormFromJSON(parsed)

			expect(restored.isFormal).toBe(true)
			expect(restored.signatureMap).toHaveLength(3)
			expect(restored.canonicalPdfHash).toBe('sha256:abc123def456')
		})
	})

	// ============================================================================
	// Edge Cases
	// ============================================================================

	describe('Edge Cases', () => {
		test('SigningField with anchor positioning', async () => {
			const adapter: Sealer = {
				async seal() {
					return {
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
						canonicalPdfHash: 'sha256:xyz789',
					}
				},
			}

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

			const formal = await draft.seal(createMockAdapter())
			const cloned = formal.clone()

			expect(cloned.isFormal).toBe(true)
			expect(cloned.signatureMap).toHaveLength(3)
			expect(cloned.canonicalPdfHash).toBe('sha256:abc123def456')

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
	// Sigblock → SigningField pass-through (v2-minimal)
	// ============================================================================

	describe('Sigblock seal pass-through for new types', () => {
		const sigBlocks: Record<string, SignatureBlock> = {
			'sb-landlord-sig': {
				type: 'signature',
				page: 1,
				x: 100,
				y: 500,
				width: 200,
				height: 30,
				partyRole: 'landlord',
				label: 'Landlord signature',
			},
			'sb-landlord-cap': {
				type: 'capacity',
				page: 1,
				x: 100,
				y: 540,
				width: 200,
				height: 14,
				partyRole: 'landlord',
				label: 'Landlord capacity',
			},
			'sb-landlord-print': {
				type: 'printed_name',
				page: 1,
				x: 100,
				y: 560,
				width: 200,
				height: 14,
				partyRole: 'landlord',
				label: 'Landlord printed name',
			},
			'sb-landlord-date': {
				type: 'date',
				page: 1,
				x: 320,
				y: 500,
				width: 100,
				height: 14,
				partyRole: 'landlord',
				label: 'Date',
			},
		}

		const buildDraft = () =>
			createFormWithSignature(sigBlocks)
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

		test('seal generates SigningField with type capacity for capacity sigblocks', async () => {
			const formal = await buildDraft().seal(createMockAdapter())

			const capacityField = formal.signatureMap?.find((f) => f.id === 'sb-landlord-cap')
			expect(capacityField).toBeDefined()
			expect(capacityField?.type).toBe('capacity')
			expect(capacityField?.signerId).toBe('landlord-signer')
		})

		test('seal generates SigningField with type printed_name for printed_name sigblocks', async () => {
			const formal = await buildDraft().seal(createMockAdapter())

			const printedField = formal.signatureMap?.find((f) => f.id === 'sb-landlord-print')
			expect(printedField).toBeDefined()
			expect(printedField?.type).toBe('printed_name')
			expect(printedField?.signerId).toBe('landlord-signer')
		})

		test('seal still translates date sigblocks to date_signed (regression)', async () => {
			const formal = await buildDraft().seal(createMockAdapter())

			const dateField = formal.signatureMap?.find((f) => f.id === 'sb-landlord-date')
			expect(dateField).toBeDefined()
			expect(dateField?.type).toBe('date_signed')
		})

		test('seal preserves signature sigblocks alongside new types', async () => {
			const formal = await buildDraft().seal(createMockAdapter())

			const sigField = formal.signatureMap?.find((f) => f.id === 'sb-landlord-sig')
			expect(sigField).toBeDefined()
			expect(sigField?.type).toBe('signature')

			// All four blocks should be in the signatureMap (definition mode uses core's generated map)
			expect(formal.signatureMap).toHaveLength(4)
		})
	})

	// ============================================================================
	// Anchor mode: SigningField placement from anchorBlocks
	// ============================================================================

	describe('Anchor mode seal (anchorBlocks, no signatureBlocks)', () => {
		const anchorBlocks: Record<string, AnchorBlock> = {
			'anc-landlord-sig': {
				type: 'signature',
				anchor: { text: 'LANDLORD SIGNATURE:', offsetX: 0, offsetY: 10 },
				width: 200,
				height: 40,
				partyRole: 'landlord',
				label: 'Landlord signature',
				required: true,
			},
			'anc-tenant-sig': {
				type: 'signature',
				anchor: { text: 'TENANT SIGNATURE:', offsetX: 0, offsetY: 10 },
				width: 200,
				height: 40,
				partyRole: 'tenant',
				label: 'Tenant signature',
			},
		}

		const createFormWithAnchorBlocks = () =>
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
						types: ['person'],
						signature: { required: true },
					},
					tenant: {
						label: 'Tenant',
						types: ['person'],
						signature: { required: true },
					},
				})
				.inlineLayer('docx', {
					mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
					text: 'LANDLORD SIGNATURE:\n\n\nTENANT SIGNATURE:\n\n',
					anchorBlocks,
				})
				.defaultLayer('docx')
				.build()

		// A mock adapter that simulates anchor-text resolution: it receives anchorFields
		// with signer bindings and returns them with resolved coordinates.
		const createAnchorAdapter = (): Sealer => ({
			async seal(request) {
				const fields = request.anchorFields ?? []
				// Simulate resolution: map anchor text to page/x/y positions
				const anchorPositions: Record<string, { page: number; x: number; y: number }> = {
					'LANDLORD SIGNATURE:': { page: 1, x: 72, y: 300 },
					'TENANT SIGNATURE:': { page: 1, x: 72, y: 400 },
				}
				const signatureMap: SigningField[] = fields.map((f) => ({
					...f,
					...(f.anchor && anchorPositions[f.anchor.text]
						? {
								page: anchorPositions[f.anchor.text]!.page,
								x: anchorPositions[f.anchor.text]!.x + f.anchor.offsetX,
								y: anchorPositions[f.anchor.text]!.y + f.anchor.offsetY,
							}
						: {}),
				}))
				return { signatureMap, canonicalPdfHash: 'sha256:anchor-test' }
			},
		})

		const buildAnchorDraft = () =>
			createFormWithAnchorBlocks()
				.fill({
					fields: { rentAmount: 1200 },
					parties: {
						landlord: { id: 'landlord-0', name: 'John Landlord' },
						tenant: { id: 'tenant-0', name: 'Jane Tenant' },
					},
				})
				.addSigner('landlord-signer', { person: { name: 'John Landlord' } })
				.addSigner('tenant-signer', { person: { name: 'Jane Tenant' } })
				.addSignatory('landlord', 'landlord-0', { signerId: 'landlord-signer' })
				.addSignatory('tenant', 'tenant-0', { signerId: 'tenant-signer' })

		test('anchor mode passes anchorFields to adapter with correct signer bindings', async () => {
			let capturedRequest: Parameters<Sealer['seal']>[0] | undefined
			const spyAdapter: Sealer = {
				async seal(req) {
					capturedRequest = req
					return {
						signatureMap: req.anchorFields ?? [],
						canonicalPdfHash: 'sha256:spy',
					}
				},
			}

			await buildAnchorDraft().seal(spyAdapter)

			// Core must pass pre-built anchor fields with signer bindings resolved
			expect(capturedRequest?.anchorFields).toBeDefined()
			expect(capturedRequest?.anchorFields).toHaveLength(2)

			const landlordField = capturedRequest?.anchorFields?.find((f) => f.id === 'anc-landlord-sig')
			expect(landlordField?.signerId).toBe('landlord-signer')
			expect(landlordField?.type).toBe('signature')
			expect(landlordField?.anchor?.text).toBe('LANDLORD SIGNATURE:')
			expect(landlordField?.anchor?.offsetX).toBe(0)
			expect(landlordField?.anchor?.offsetY).toBe(10)
			expect(landlordField?.width).toBe(200)
			expect(landlordField?.height).toBe(40)
			expect(landlordField?.required).toBe(true)
			expect(landlordField?.label).toBe('Landlord signature')

			const tenantField = capturedRequest?.anchorFields?.find((f) => f.id === 'anc-tenant-sig')
			expect(tenantField?.signerId).toBe('tenant-signer')
			expect(tenantField?.anchor?.text).toBe('TENANT SIGNATURE:')
		})

		test('anchor mode seal produces signatureMap with adapter-resolved positions', async () => {
			const formal = await buildAnchorDraft().seal(createAnchorAdapter())

			// Adapter resolved anchor text to actual page/x/y positions
			expect(formal.signatureMap).toHaveLength(2)

			const landlordField = formal.signatureMap?.find((f) => f.id === 'anc-landlord-sig')
			expect(landlordField?.page).toBe(1)
			expect(landlordField?.x).toBe(72)   // anchorPositions.x + offsetX (0)
			expect(landlordField?.y).toBe(310)  // anchorPositions.y + offsetY (10)
			expect(landlordField?.signerId).toBe('landlord-signer')
			expect(landlordField?.anchor?.text).toBe('LANDLORD SIGNATURE:')

			const tenantField = formal.signatureMap?.find((f) => f.id === 'anc-tenant-sig')
			expect(tenantField?.page).toBe(1)
			expect(tenantField?.x).toBe(72)
			expect(tenantField?.y).toBe(410)    // 400 + 10
			expect(tenantField?.signerId).toBe('tenant-signer')
		})

		test('anchor mode date block type maps to date_signed in anchor fields', async () => {
			const dateAnchorBlocks: Record<string, AnchorBlock> = {
				'anc-date': {
					type: 'date',
					anchor: { text: 'DATE:', offsetX: 50, offsetY: 0 },
					width: 100,
					height: 20,
					partyRole: 'landlord',
				},
			}
			const formWithDate = form()
				.name('anchor-date-form')
				.version('1.0.0')
				.title('Date Anchor Form')
				.fields({ name: { type: 'text', label: 'Name' } })
				.parties({
					landlord: { label: 'Landlord', types: ['person'], signature: { required: true } },
				})
				.inlineLayer('docx', {
					mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
					text: 'DATE:',
					anchorBlocks: dateAnchorBlocks,
				})
				.defaultLayer('docx')
				.build()

			let capturedFields: SigningField[] | undefined
			const spyAdapter: Sealer = {
				async seal(req) {
					capturedFields = req.anchorFields
					return { signatureMap: req.anchorFields ?? [], canonicalPdfHash: 'sha256:date-test' }
				},
			}

			await formWithDate
				.fill({ fields: { name: 'Test' }, parties: { landlord: { id: 'landlord-0', name: 'Landlord' } } })
				.addSigner('l-sig', { person: { name: 'Landlord' } })
				.addSignatory('landlord', 'landlord-0', { signerId: 'l-sig' })
				.seal(spyAdapter)

			// date block must map to date_signed (mirrors definition mode behavior)
			expect(capturedFields?.[0]?.type).toBe('date_signed')
		})

		test('a non-PDF layer requires an adapter', async () => {
			const formDef = form()
				.name('no-blocks-docx')
				.version('1.0.0')
				.title('No Blocks DOCX')
				.fields({ name: { type: 'text', label: 'Name' } })
				.parties({
					signer: { label: 'Signer', types: ['person'], signature: { required: true } },
				})
				.inlineLayer('docx', {
					mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
					text: 'DOCX content',
				})
				.defaultLayer('docx')
				.build()

			const draft = formDef
				.fill({ fields: { name: 'Test' }, parties: { signer: { id: 'signer-0', name: 'Signer' } } })
				.addSigner('s-sig', { person: { name: 'Signer' } })
				.addSignatory('signer', 'signer-0', { signerId: 's-sig' })

			await expect(draft.seal()).rejects.toThrow(
				/Cannot seal .* without an adapter/,
			)
		})

		test('signatureBlocks (definition mode) behavior is unchanged when both are present — signatureBlocks wins', async () => {
			// When BOTH signatureBlocks and anchorBlocks exist, definition mode takes precedence
			const sigBlock: SignatureBlock = {
				type: 'signature',
				page: 1,
				x: 100,
				y: 500,
				width: 200,
				height: 50,
				partyRole: 'landlord',
			}
			const formWithBoth = form()
				.name('both-blocks-form')
				.version('1.0.0')
				.title('Both Blocks Form')
				.fields({ rentAmount: { type: 'number', label: 'Rent' } })
				.parties({
					landlord: { label: 'Landlord', types: ['person'], signature: { required: true } },
					tenant: { label: 'Tenant', types: ['person'] },
				})
				.inlineLayer('docx', {
					mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
					text: 'Template',
					signatureBlocks: { 'sig-1': sigBlock },
					anchorBlocks: { 'anc-1': anchorBlocks['anc-landlord-sig']! },
				})
				.defaultLayer('docx')
				.build()

			let capturedRequest: Parameters<Sealer['seal']>[0] | undefined
			const spyAdapter: Sealer = {
				async seal(req) {
					capturedRequest = req
					return { signatureMap: [], canonicalPdfHash: 'sha256:both' }
				},
			}

			await formWithBoth
				.fill({
					fields: { rentAmount: 1500 },
					parties: {
						landlord: { id: 'landlord-0', name: 'John Landlord' },
						tenant: { id: 'tenant-0', name: 'Jane Tenant' },
					},
				})
				.addSigner('landlord-signer', { person: { name: 'John Landlord' } })
				.addSignatory('landlord', 'landlord-0', { signerId: 'landlord-signer' })
				.seal(spyAdapter)

			// Definition mode: anchorFields must NOT be set; signatureBlocks drove placement
			expect(capturedRequest?.anchorFields).toBeUndefined()
		})
	})
})
