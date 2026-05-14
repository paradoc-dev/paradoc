/**
 * Utility functions for parsing data payloads from various sources:
 * - File paths (JSON/YAML)
 * - Inline JSON strings
 * - Stdin (via "-" token)
 */

import { parse } from '@paradoc/core'
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
		const { raw } = await readTextInput('-')
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
 * Normalize data to ensure it has the expected { fields: {...} } structure.
 * If data already has a `fields` property, returns as-is.
 * Otherwise, wraps the data in { fields: data }.
 *
 * @param data - Raw data object
 * @returns Normalized data with fields property
 */
export function normalizeFormData(data: Record<string, unknown>): {
	fields: Record<string, unknown>
	parties?: Record<string, unknown>
	annexes?: Record<string, unknown>
	signers?: Record<string, unknown>
	signatories?: Record<string, unknown>
} {
	// Check if data already has the expected structure
	if ('fields' in data && typeof data.fields === 'object' && data.fields !== null) {
		const result: {
			fields: Record<string, unknown>
			parties?: Record<string, unknown>
			annexes?: Record<string, unknown>
			signers?: Record<string, unknown>
			signatories?: Record<string, unknown>
		} = {
			fields: data.fields as Record<string, unknown>,
		}

		if (data.parties) {
			result.parties = data.parties as Record<string, unknown>
		}
		if (data.annexes) {
			result.annexes = data.annexes as Record<string, unknown>
		}
		if (data.signers) {
			result.signers = data.signers as Record<string, unknown>
		}
		if (data.signatories) {
			result.signatories = data.signatories as Record<string, unknown>
		}

		return result
	}

	// Wrap data in fields
	return { fields: data }
}
