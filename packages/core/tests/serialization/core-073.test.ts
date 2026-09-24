/**
 * core-073: a YAML syntax error lost its line and reason in `parse` and `load`.
 * Input: a form YAML with a bad indent on line 6.
 * Expected: the thrown error (or its cause chain) carries the YAML parser's reason / line.
 */
import { describe, test, expect } from 'vitest'
import { parse as parseYaml } from 'yaml'
import { load, parse } from '@/serialization'

const bad = 'kind: form\nname: x\nfields:\n  a:\n    type: text\n   label: bad indent\n'

function chain(err: unknown): string {
	const parts: string[] = []
	let e: unknown = err
	while (e instanceof Error) {
		parts.push(`${e.name}: ${e.message}`)
		e = (e as Error & { cause?: unknown }).cause
	}
	return parts.join(' <- ')
}

describe('core-073', () => {
	const yamlReason = (() => {
		try {
			parseYaml(bad)
			return ''
		} catch (e) {
			return (e as Error).message.split('\n')[0]!
		}
	})()

	test('the YAML parser itself reports a reason', () => {
		expect(yamlReason).not.toBe('')
	})

	test('parse keeps the YAML reason', () => {
		let err: unknown
		try {
			parse(bad)
		} catch (e) {
			err = e
		}
		expect(chain(err)).toContain(yamlReason)
	})

	test('load keeps the YAML reason', () => {
		let err: unknown
		try {
			load(bad)
		} catch (e) {
			err = e
		}
		expect(chain(err)).toContain(yamlReason)
	})
})
