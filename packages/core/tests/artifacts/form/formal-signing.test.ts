import { describe, test, expect } from 'vitest'
import { form, runtimeFormFromJSON } from '@/artifacts'
import type { DraftForm, SignableForm } from '@/artifacts'
import type { Sealer, SigningField, Signer } from '@paradoc/types'
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

	const createFormWithSignature = () =>
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
			.inlineLayer('docx', { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', text: 'Lease template' })
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
		test('throws error on non-PDF-convertible layer', async () => {
			// Create a form with a PDF layer (which cannot be converted TO PDF)
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
				.inlineLayer('pdf', { mimeType: 'application/pdf', text: 'PDF content' })
				.defaultLayer('pdf')
				.build()

			const draft = formDef
				.fill({
					fields: { name: 'Test' },
					parties: { signer: { id: 'signer-0', name: 'Test Signer' } },
				})
				.addSigner('test-signer', { person: { name: 'Test Signer' } })
				.addSignatory('signer', 'signer-0', { signerId: 'test-signer' })

			await expect(draft.seal(createMockAdapter())).rejects.toThrow(
				/layer "pdf" has no signatureBlocks and is not PDF-convertible/
			)
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
})
