/**
 * Utility functions for parsing data payloads from various sources:
 * - File paths (JSON/YAML)
 * - Inline JSON strings
 * - Stdin (via "-" token)
 */

import { parse } from '@paradoc/core'
import type { FormData } from '@paradoc/types'
import { readTextInput } from './io.js'

export interface DataInputResult {
	data: Record<string, unknown>
	source: 'file' | 'inline' | 'stdin'
	sourcePath?: string
}

/**
 * Determines if a string looks like inline JSON (starts with { or [)
 */
function looksLikeInlineJson(value: string): boolean {
	const trimmed = value.trim()
	return trimmed.startsWith('{') || trimmed.startsWith('[')
}

/**
 * Parse data from a file path, inline JSON string, or stdin.
 *
 * Detection logic:
 * 1. If value is "-", read from stdin
 * 2. If value starts with "{" or "[", treat as inline JSON
 * 3. Otherwise, treat as file path
 *
 * @param value - File path, inline JSON, or "-" for stdin
 * @returns Parsed data with source information
 * @throws Error if parsing fails or data is not an object
 */
export async function parseDataInput(value: string): Promise<DataInputResult> {
	// Handle stdin
	if (value === '-') {
		const { raw } = await readTextInput('-', '--data')
		const parsed = parse(raw)

		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
			throw new Error('Data from stdin must be a JSON/YAML object')
		}

		return {
			data: parsed as Record<string, unknown>,
			source: 'stdin',
		}
	}

	// Handle inline JSON
	if (looksLikeInlineJson(value)) {
		try {
			const parsed = JSON.parse(value)

			if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
				throw new Error('Inline data must be a JSON object')
			}

			return {
				data: parsed as Record<string, unknown>,
				source: 'inline',
			}
		} catch (err) {
			if (err instanceof SyntaxError) {
				throw new Error(`Invalid inline JSON: ${err.message}`)
			}
			throw err
		}
	}

	// Handle file path
	const { raw, sourcePath } = await readTextInput(value)
	const parsed = parse(raw)

	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw new Error('Data file must contain a JSON/YAML object')
	}

	return {
		data: parsed as Record<string, unknown>,
		source: 'file',
		sourcePath,
	}
}

/**
 * Normalize `--data` input to the `FormData` a render takes. Input that
 * already has a `fields` record keeps its `fields`, `parties`, `annexes`,
 * `defs`, `signers` and `signatories`; anything else is taken as bare field
 * values and wrapped in `{ fields }`. The SDK validates the values themselves.
 *
 * @param data - Raw data object
 * @returns The render payload
 */
export function normalizeFormData(data: Record<string, unknown>): FormData {
	if (!('fields' in data) || typeof data.fields !== 'object' || data.fields === null) {
		return { fields: data }
	}
	const result: FormData = { fields: data.fields as FormData['fields'] }
	if (data.parties) result.parties = data.parties as FormData['parties']
	if (data.annexes) result.annexes = data.annexes as FormData['annexes']
	if (data.defs) result.defs = data.defs as FormData['defs']
	if (data.signers) result.signers = data.signers as FormData['signers']
	if (data.signatories) result.signatories = data.signatories as FormData['signatories']
	return result
}

/**
 * Wrap flat field data in `{ fields }`. A payload that already names a
 * `fields`, `parties` or `annexes` section is passed on as written, so the
 * SDK sees (and rejects) any other top-level key.
 */
export function toFormPayload(data: Record<string, unknown>): Record<string, unknown> {
	const isPayload = 'fields' in data || 'parties' in data || 'annexes' in data
	return isPayload ? data : { fields: data }
}
