/**
 * Shape tests for the artifact-kind discriminated union.
 *
 * `@paradoc/types` is Zod-free (D2): every check here is a compile-time
 * assertion (`expectTypeOf`, or an `@ts-expect-error` that `check-types`
 * turns into a real failure if the guard it covers is ever loosened).
 * `vitest run` executes these as ordinary passing tests; `tsc --noEmit` is
 * what actually enforces them.
 */
import { describe, it, expectTypeOf } from 'vitest'
import type { Artifact } from '../src/schemas/artifacts'
import type { Form } from '../src/schemas/artifacts/form'
import type { Document } from '../src/schemas/artifacts/document'
import type { Checklist } from '../src/schemas/artifacts/checklist'
import type { Bundle } from '../src/schemas/artifacts/bundle'

describe('Artifact', () => {
	it('is the union of the four concrete artifact kinds', () => {
		expectTypeOf<Artifact>().toEqualTypeOf<Form | Document | Checklist | Bundle>()
	})

	it('narrows to Form when kind is "form"', () => {
		function narrow(artifact: Artifact): Form | undefined {
			if (artifact.kind === 'form') {
				expectTypeOf(artifact).toEqualTypeOf<Form>()
				return artifact
			}
			return undefined
		}
		expectTypeOf(narrow).returns.toEqualTypeOf<Form | undefined>()
	})

	it('narrows to Bundle when kind is "bundle"', () => {
		function narrow(artifact: Artifact): Bundle | undefined {
			if (artifact.kind === 'bundle') {
				expectTypeOf(artifact).toEqualTypeOf<Bundle>()
				return artifact
			}
			return undefined
		}
		expectTypeOf(narrow).returns.toEqualTypeOf<Bundle | undefined>()
	})

	it('rejects a fifth kind literal', () => {
		// @ts-expect-error "checklist-item" is not one of the four artifact kinds.
		const bad: Artifact['kind'] = 'checklist-item'
		void bad
	})

	it('rejects an artifact missing the required name field', () => {
		// @ts-expect-error every artifact kind requires `name` from ArtifactBase.
		const bad: Form = { kind: 'form' }
		void bad
	})
})
