import { describe, expect, it } from 'vitest'

import { DEFAULT_SIGNATURES, BUILTIN_IMPLS } from '../src/index'

/**
 * The drift guard. The design-time registry and the runtime-callable set must
 * be identical, so a function can never type-check green and then throw at
 * runtime. Domain (party/witness) functions are host-injected, so they are the
 * only registry entries without a builtin implementation.
 */
describe('registry / implementation conformance', () => {
	const implNames = new Set(Object.keys(BUILTIN_IMPLS))
	const nonDomain = DEFAULT_SIGNATURES.filter((s) => s.category !== 'domain').map((s) => s.name)
	const domain = DEFAULT_SIGNATURES.filter((s) => s.category === 'domain').map((s) => s.name)

	it('every non-domain registry function has a builtin implementation', () => {
		const missing = nonDomain.filter((n) => !implNames.has(n))
		expect(missing).toEqual([])
	})

	it('every builtin implementation is a declared non-domain function', () => {
		const declared = new Set(nonDomain)
		const extra = [...implNames].filter((n) => !declared.has(n))
		expect(extra).toEqual([])
	})

	it('domain functions are host-injected, not builtins', () => {
		const leaked = domain.filter((n) => implNames.has(n))
		expect(leaked).toEqual([])
		expect(domain.length).toBeGreaterThan(0)
	})
})
