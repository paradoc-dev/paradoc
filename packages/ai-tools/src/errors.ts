import { ZodError } from 'zod'
import type { ToolError } from './contracts'

export function toolError(code: string, message: string, path?: Array<string | number>, retryable = false): ToolError {
	return { code, message, ...(path ? { path } : {}), ...(retryable ? { retryable: true } : {}) }
}

export function errorFromUnknown(error: unknown, fallbackCode = 'execution_error'): ToolError {
	if (error instanceof ZodError) {
		return toolError('invalid_input', error.message)
	}
	if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
		const value = error as { code?: unknown; message?: unknown; path?: unknown; retryable?: unknown }
		if (typeof value.code === 'string' && typeof value.message === 'string') {
			return toolError(
				value.code,
				value.message,
				Array.isArray(value.path) ? value.path.filter((part): part is string | number => typeof part === 'string' || typeof part === 'number') : undefined,
				value.retryable === true,
			)
		}
	}
	return toolError(fallbackCode, error instanceof Error ? error.message : 'Unknown tool error')
}
