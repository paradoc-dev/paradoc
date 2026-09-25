export const DEFAULT_MODEL_OUTPUT_MAX_BYTES = 16_384

export type ToolResultOutput<Value = unknown> = { type: 'json'; value: Value }

type ContentResult = {
	content?: string
	encoding?: 'utf-8' | 'base64'
	truncated?: boolean
	[key: string]: unknown
}

function isContentResult(value: unknown): value is ContentResult {
	return typeof value === 'object' && value !== null && !Array.isArray(value) && typeof (value as ContentResult).content === 'string'
}

function budget(value: number | undefined): number {
	if (value === undefined || !Number.isFinite(value)) return DEFAULT_MODEL_OUTPUT_MAX_BYTES
	return Math.max(1, Math.floor(value))
}

export function truncateContent(
	content: string,
	encoding: 'utf-8' | 'base64',
	maxBytes: number,
): { content: string; truncated: boolean } {
	if (encoding === 'base64') {
		const chars = Math.floor(maxBytes / 4) * 4
		return { content: content.slice(0, chars), truncated: content.length > chars }
	}

	const bytes = new TextEncoder().encode(content)
	if (bytes.byteLength <= maxBytes) return { content, truncated: false }
	let end = Math.min(maxBytes, bytes.byteLength)
	const decoder = new TextDecoder('utf-8', { fatal: true })
	while (end > 0) {
		try {
			return { content: decoder.decode(bytes.slice(0, end)), truncated: true }
		} catch {
			end -= 1
		}
	}
	return { content: '', truncated: true }
}

export function boundModelValue<Output>(output: Output, maxBytes?: number): Output {
	if (!isContentResult(output)) return output
	const truncated = truncateContent(output.content!, output.encoding ?? 'utf-8', budget(maxBytes))
	return truncated.truncated ? { ...output, ...truncated } : output
}

export function toModelOutput<Output>(output: Output, maxBytes?: number): ToolResultOutput<Output> {
	return { type: 'json', value: boundModelValue(output, maxBytes) }
}

/** Preserve the application value while teaching JSON-only runtimes what to send the model. */
export function attachModelOutputSerialization<Output>(output: Output, maxBytes?: number): Output {
	if (typeof output !== 'object' || output === null) return output
	Object.defineProperty(output, 'toJSON', {
		configurable: true,
		value: () => boundModelValue(output, maxBytes),
	})
	return output
}
