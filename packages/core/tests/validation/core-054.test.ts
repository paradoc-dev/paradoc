/**
 * core-054: isForm / validateForm accept an outdated $schema that parseForm and validate reject.
 * Input: a valid form object with $schema = schemaVersionUrl('2026-08-10') (an earlier dated URL).
 * Expected: isForm false and validateForm fails, matching validate() and parseForm.
 * Actual (screened commit): isForm true, validateForm success, while validate() reports outdated-version.
 */
import { describe, expect, test } from 'vitest'
import { schemaVersionUrl } from '@paradoc/schemas'
import { isForm } from '@/validation/type-guards'
import { validateForm } from '@/validation/validators'
import { validate } from '@/validation/artifact'

const outdated = { $schema: schemaVersionUrl('2026-08-10'), kind: 'form', name: 'intake', fields: { name: { type: 'text' } } }

describe('core-054', () => {
	test('control: validate() rejects the outdated $schema', () => {
		const r = validate(outdated)
		expect(r.issues).toBeDefined()
	})
	test('isForm rejects the outdated $schema', () => {
		expect(isForm(outdated)).toBe(false)
	})
	test('validateForm rejects the outdated $schema', () => {
		const r = validateForm(outdated) as unknown
		expect(JSON.stringify(r)).toMatch(/version|schema/i)
	})
})
