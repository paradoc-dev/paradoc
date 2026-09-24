/**
 * Shape tests for the runtime (filled-artifact) types: parties, signers,
 * form data, and the draft/final(/signable/executed) JSON phase unions.
 *
 * See tests/artifact-union.test.ts for the testing idiom this file follows:
 * `@paradoc/types` has no runtime values, so every assertion here is either
 * an `expectTypeOf` compile-time check or an `@ts-expect-error` that
 * `check-types` fails if the guard it covers is loosened.
 */
import { describe, it, expectTypeOf } from 'vitest'
import type { Person, Organization } from '../src/schemas/primitives'
import type {
	Party,
	RuntimeParty,
	WitnessParty,
	Signer,
	PartySignatory,
	Attestation,
	AttestationTarget,
	RuntimeContentJSON,
	FormPhase,
	ChecklistPhase,
	DocumentPhase,
	BundlePhase,
	FormData,
	RuntimeContext,
	DraftDocumentJSON,
	FinalDocumentJSON,
	RuntimeDocumentJSON,
	DraftBundleJSON,
	SignableBundleJSON,
	ExecutedBundleJSON,
	RuntimeBundleJSON,
} from '../src/runtime'

describe('Party', () => {
	it('is Person or Organization, nothing narrower', () => {
		expectTypeOf<Party>().toEqualTypeOf<Person | Organization>()
	})
})

describe('RuntimeParty', () => {
	it('is a Party carrying the role-assigned id', () => {
		expectTypeOf<RuntimeParty>().toMatchTypeOf<{ id: string }>()
		expectTypeOf<RuntimeParty>().toMatchTypeOf<Person | Organization>()
	})

	it('rejects a party with no id', () => {
		// @ts-expect-error RuntimeParty requires the `<role>-<index>` id core assigns.
		const bad: RuntimeParty = { name: 'Jane Smith' }
		void bad
	})
})

describe('WitnessParty', () => {
	it('always carries a Person, never an Organization', () => {
		expectTypeOf<WitnessParty['party']>().toEqualTypeOf<Person>()
	})
})

describe('Signer / PartySignatory', () => {
	it('a Signer is keyed to a Person identity', () => {
		expectTypeOf<Signer['person']>().toEqualTypeOf<Person>()
	})

	it('a PartySignatory references a signer by id', () => {
		expectTypeOf<PartySignatory>().toHaveProperty('signerId').toEqualTypeOf<string>()
	})

	it('rejects a signatory with no signerId', () => {
		// @ts-expect-error signerId is required; only capacity is optional.
		const bad: PartySignatory = { capacity: 'CEO' }
		void bad
	})
})

describe('Attestation', () => {
	const signature = { timestamp: '2026-09-24T00:00:00Z', method: 'typed' } as const
	const attestsTo = [{ role: 'buyer', partyId: 'buyer-0', signerId: 'bea' }]

	it('requires a signature and its attested targets', () => {
		expectTypeOf<Attestation>().toHaveProperty('signature')
		expectTypeOf<Attestation>().toHaveProperty('attestsTo')
	})

	it('names its witness by reference or inline', () => {
		const byReference: Attestation = { witnessId: 'w1', signature, attestsTo }
		const inline: Attestation = {
			witness: { id: 'w1', party: { name: 'Wes Witness' } },
			signature,
			attestsTo,
		}
		void byReference
		void inline
	})

	it('rejects an attestation that names no witness', () => {
		// @ts-expect-error an attestation must name its witness.
		const bad: Attestation = { signature, attestsTo }
		void bad
	})

	it('rejects an attestation that names its witness both ways', () => {
		// @ts-expect-error witnessId and witness are exclusive.
		const bad: Attestation = { witnessId: 'w1', witness: { id: 'w1', party: { name: 'Wes Witness' } }, signature, attestsTo }
		void bad
	})

	it('names the attested party role `role`, as captures do', () => {
		expectTypeOf<AttestationTarget>().toHaveProperty('role').toEqualTypeOf<string>()
		expectTypeOf<AttestationTarget>().not.toHaveProperty('roleId')
	})
})

describe('phase unions', () => {
	it('types a bundle content phase as the artifact phases, not any string', () => {
		expectTypeOf<RuntimeContentJSON['phase']>().toEqualTypeOf<
			FormPhase | ChecklistPhase | DocumentPhase | BundlePhase | undefined
		>()
	})

	it('rejects an unknown content phase', () => {
		// @ts-expect-error a content phase is one of the artifact phases.
		const bad: RuntimeContentJSON = { kind: 'form', artifact: {}, targetLayer: 'text', phase: 'archived' }
		void bad
	})
})

describe('FormData', () => {
	it('requires fields, and leaves everything else optional', () => {
		const minimal: FormData = { fields: {} }
		expectTypeOf(minimal).toMatchTypeOf<FormData>()
	})

	it('rejects a payload missing fields', () => {
		// @ts-expect-error `fields` is FormData's one required member.
		const bad: FormData = {}
		void bad
	})
})

describe('RuntimeContext', () => {
	it('carries exactly the one fixed clock, asOf', () => {
		expectTypeOf<RuntimeContext>().toEqualTypeOf<{ asOf: { date: string; datetime: string } }>()
	})
})

describe('document JSON phases', () => {
	it('narrows RuntimeDocumentJSON by its phase discriminant', () => {
		function narrow(json: RuntimeDocumentJSON): string {
			if (json.phase === 'final') {
				expectTypeOf(json).toEqualTypeOf<FinalDocumentJSON>()
				return json.finalizedAt
			}
			expectTypeOf(json).toEqualTypeOf<DraftDocumentJSON>()
			return json.targetLayer
		}
		expectTypeOf(narrow).parameter(0).toEqualTypeOf<RuntimeDocumentJSON>()
	})

	it('rejects a draft document carrying finalizedAt', () => {
		// @ts-expect-error finalizedAt only exists once phase is "final".
		const bad: DraftDocumentJSON = { phase: 'draft', document: {}, targetLayer: 'pdf', finalizedAt: '2026-01-01T00:00:00Z' }
		void bad
	})
})

describe('bundle JSON phases', () => {
	it('is the union of draft, signable, and executed', () => {
		expectTypeOf<RuntimeBundleJSON>().toEqualTypeOf<DraftBundleJSON | SignableBundleJSON | ExecutedBundleJSON>()
	})

	it('only the executed phase carries executedAt', () => {
		expectTypeOf<ExecutedBundleJSON>().toHaveProperty('executedAt').toEqualTypeOf<string>()
		expectTypeOf<DraftBundleJSON>().not.toHaveProperty('executedAt')
		expectTypeOf<SignableBundleJSON>().not.toHaveProperty('executedAt')
	})
})
