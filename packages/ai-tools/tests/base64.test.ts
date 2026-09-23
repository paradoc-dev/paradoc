import { afterEach, describe, expect, it, vi } from 'vitest'
import { bytesToBase64 } from '../src/registry-client'

const SIZES = [0, 1, 32767, 32768, 32769, 100000]

function patternBytes(size: number): Uint8Array {
	const bytes = new Uint8Array(size)
	for (let index = 0; index < size; index++) bytes[index] = (index * 131 + (index >> 7) * 17 + 7) & 0xff
	return bytes
}

/** Hide the native `toBase64` on this instance so the `btoa` fallback runs. */
function withoutNativeToBase64(bytes: Uint8Array): Uint8Array {
	Object.defineProperty(bytes, 'toBase64', { value: undefined })
	return bytes
}

describe('bytesToBase64', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	describe.each(SIZES)('%i bytes', (size) => {
		it('matches Buffer base64 through the btoa fallback and round-trips', () => {
			const bytes = patternBytes(size)
			const encoded = bytesToBase64(withoutNativeToBase64(bytes))

			expect(encoded).toBe(Buffer.from(bytes).toString('base64'))
			expect(new Uint8Array(Buffer.from(encoded, 'base64'))).toEqual(patternBytes(size))
		})
	})

	it('delegates to the native toBase64 when the runtime has one', () => {
		const bytes = patternBytes(8)
		const toBase64 = vi.fn(() => 'native')
		Object.defineProperty(bytes, 'toBase64', { value: toBase64 })

		expect(bytesToBase64(bytes)).toBe('native')
		expect(toBase64).toHaveBeenCalledOnce()
	})

	it('throws when the runtime has neither toBase64 nor btoa', () => {
		vi.stubGlobal('btoa', undefined)
		expect(() => bytesToBase64(withoutNativeToBase64(patternBytes(4)))).toThrow(
			'This runtime cannot encode binary tool output as base64',
		)
	})
})
