/**
 * schemas-003: registering schemas by id wipes their title and description.
 * Input: FormSchema after src/zod/module.ts runs ParadocRegistry.add(FormSchema, { id: 'Form' }),
 *        and the published bundle of the current schema version.
 * Expected: FormSchema.meta() keeps title 'Form' and its description; bundle $defs.Form has a title.
 * Actual: FormSchema.meta() is { id: 'Form' }; only $defs.Layer keeps a title/description.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FormSchema } from '../src/zod'
import { SCHEMA_VERSION } from '../src/zod/config'

describe('schemas-003', () => {
	it('keeps the Form title and description after registration', () => {
		expect(FormSchema.meta()).toMatchObject({ id: 'Form', title: 'Form' })
		expect(FormSchema.description).toBeTypeOf('string')
	})

	it('publishes a title for every bundle $defs entry', () => {
		const bundle = JSON.parse(readFileSync(join(__dirname, '..', 'schemas', `${SCHEMA_VERSION}.json`), 'utf8'))
		const untitled = Object.entries(bundle.$defs as Record<string, { title?: string }>)
			.filter(([, def]) => !def.title)
			.map(([name]) => name)
		expect(untitled).toEqual([])
	})
})
