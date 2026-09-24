/**
 * The one Zod parser factory and issue mapping every validator and parser in
 * this folder uses.
 */

import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { ZodError, ZodType } from 'zod'

/** Zod issues as Standard Schema issues, with each issue's path kept as Zod reports it. */
export function zodIssues(error: ZodError): StandardSchemaV1.Issue[] {
	return error.issues.map((issue) => ({ message: issue.message, path: issue.path }))
}

/** The first issue of a failed parse, as one message that names the schema and the path. */
export function formatZodError(error: ZodError, schemaName: string): string {
	const firstIssue = error.issues[0]
	if (!firstIssue) return `Invalid ${schemaName}: validation failed`

	const path = firstIssue.path.length > 0 ? ` at ${firstIssue.path.join('.')}` : ''
	return `Invalid ${schemaName}${path}: ${firstIssue.message}`
}

/**
 * A parse function for a schema: it returns the parsed value, or throws an
 * `Error` whose message names the first issue.
 */
export function createParser<T>(
	schemaName: string,
	schema: ZodType<T>,
): (input: unknown) => T {
	return (input: unknown): T => {
		const result = schema.safeParse(input)
		if (!result.success) {
			throw new Error(formatZodError(result.error, schemaName))
		}
		return result.data
	}
}
