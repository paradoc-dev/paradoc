import { describe, expect, test } from 'vitest'
import { makeResolver } from '../src/artifact'

function recordingFetch() {
	const urls: string[] = []
	const fetch = (async (input: RequestInfo | URL) => {
		urls.push(String(input))
		return new Response(new Uint8Array([7, 8]))
	}) as typeof globalThis.fetch
	return { urls, fetch }
}

describe('makeResolver', () => {
	test('returns no resolver without a base URL', () => {
		expect(makeResolver(undefined)).toBeUndefined()
	})

	test('reads relative and one-leading-slash layer paths beneath the base URL', async () => {
		const { urls, fetch } = recordingFetch()
		const resolver = makeResolver('https://registry.example.test/forms/w-9', { fetch })!

		await expect(resolver.read('w-9.pdf')).resolves.toEqual(new Uint8Array([7, 8]))
		await resolver.read('/templates/w-9.pdf')

		expect(urls).toEqual([
			'https://registry.example.test/forms/w-9/w-9.pdf',
			'https://registry.example.test/forms/w-9/templates/w-9.pdf',
		])
	})

	test('rejects a layer path that escapes the base URL without fetching', async () => {
		const { urls, fetch } = recordingFetch()
		const resolver = makeResolver('https://registry.example.test/forms/w-9', { fetch })!

		await expect(resolver.read('../other/secret.pdf')).rejects.toMatchObject({ code: 'ERR_RESOLVER_OUTSIDE_ROOT' })
		expect(urls).toEqual([])
	})

	test('applies the tools fetch policy to layer reads', async () => {
		const { urls, fetch } = recordingFetch()
		const resolver = makeResolver('https://registry.example.test/forms/w-9', {
			fetch,
			approvedOrigins: ['https://cdn.example.test'],
		})!

		await expect(resolver.read('w-9.pdf')).rejects.toThrow('Origin is not approved')
		expect(urls).toEqual([])
	})
})
