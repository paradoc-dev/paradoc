import { afterEach, describe, expect, it, vi } from 'vitest'
import { boundedPresentation } from '../src/artifact'
import { FETCH_TIMEOUT_MS, safeFetch } from '../src/registry-client'

afterEach(() => {
	vi.useRealTimers()
	vi.restoreAllMocks()
})

function streamingResponse(chunks: Uint8Array[]): Response {
	return new Response(new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(chunk)
			controller.close()
		},
	}))
}

describe('registry transport guards', () => {
	it('rejects declared and streamed bodies above the byte limit', async () => {
		const declared = vi.fn(async () => new Response('x', { headers: { 'content-length': '2' } }))
		await expect(safeFetch('https://registry.example/item', 1, declared)).rejects.toThrow(/too large/i)
		const streamed = vi.fn(async () => streamingResponse([new Uint8Array([1]), new Uint8Array([2])]))
		await expect(safeFetch('https://registry.example/item', 1, streamed)).rejects.toThrow(/exceeded/i)
	})

	it('honors caller aborts and the request timeout', async () => {
		const controller = new AbortController()
		controller.abort(new Error('caller stopped'))
		const fetcher = vi.fn()
		await expect(safeFetch('https://registry.example/item', 1, fetcher, { signal: controller.signal })).rejects.toThrow(/caller stopped/)
		expect(fetcher).not.toHaveBeenCalled()

		vi.useFakeTimers()
		const hanging = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
			init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
		}))
		const request = safeFetch('https://registry.example/item', 1, hanging)
		const rejection = expect(request).rejects.toThrow(/timed out/i)
		await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS)
		await rejection
	})

	it('stops after the configured redirect limit', async () => {
		const fetcher = vi.fn(async () => new Response(null, { status: 302, headers: { location: '/again' } }))
		await expect(safeFetch('https://registry.example/start', 1, fetcher, { maxRedirects: 1 })).rejects.toThrow(/too many redirects/i)
		expect(fetcher).toHaveBeenCalledTimes(2)
	})
})

describe('render presentation guards', () => {
	it('omits content when include_content is false', () => {
		expect(boundedPresentation({ content: 'secret', encoding: 'utf-8', byte_length: 6 }, { include_content: false }))
			.toEqual({ byte_length: 6, truncated: true })
	})

	it('keeps truncated base64 decodable and within max_bytes', () => {
		const output = boundedPresentation({ content: 'YWJjZGVmZ2hp', encoding: 'base64', byte_length: 9 }, { max_bytes: 5 })
		expect(output.content).toBe('YWJj')
		expect(Buffer.from(output.content!, 'base64').byteLength).toBeLessThanOrEqual(5)
		expect(output.truncated).toBe(true)
	})
})
