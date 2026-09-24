/**
 * Artifact Parsers
 *
 * Ready-to-use parse functions for all Paradoc artifacts and blocks.
 * These use Zod schemas directly for strict validation.
 */

import type {
	Form,
	FormField,
	FormAnnex,
	FormParty,
	Layer,
	Bundle,
	BundleContentItem,
	Document,
	Checklist,
	ChecklistItem,
} from '@paradoc/types'
import {
	FormSchema,
	DocumentSchema,
	BundleSchema,
	ChecklistSchema,
	FormFieldSchema,
	FormAnnexSchema,
	FormPartySchema,
	LayerSchema,
	BundleContentItemSchema,
	ChecklistItemSchema,
} from '@paradoc/schemas'
import { type ZodType, type ZodError } from 'zod'
import { assertCurrentSchemaVersion } from '@/serialization/schema-version'

/**
 * Format Zod error for display
 */
function formatZodError(error: ZodError, schemaName: string): string {
	const firstIssue = error.issues[0]
	if (!firstIssue) return `Invalid ${schemaName}: validation failed`

	const path = firstIssue.path.length > 0 ? ` at ${firstIssue.path.join('.')}` : ''
	return `Invalid ${schemaName}${path}: ${firstIssue.message}`
}

/**
 * Factory to create a parser function using Zod schema directly
 */
function createArtifactParser<T>(
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

/**
 * Factory for a whole-artifact parser. Every artifact entry point parses
 * through one of these, so each holds the input to the current schema version
 * before the schema: an object may leave out `$schema`, as one built in memory
 * does, but one it declares must be current, on the root and on every inline
 * bundle part. Only `migrate` accepts another version.
 */
function createWholeArtifactParser<T>(schemaName: string, schema: ZodType<T>): (input: unknown) => T {
	const parseSchema = createArtifactParser(schemaName, schema)
	return (input: unknown): T => {
		assertCurrentSchemaVersion(input, { required: false })
		return parseSchema(input)
	}
}

// ─────────────────────────────────────────────────────────────
// Artifact Parsers
// ─────────────────────────────────────────────────────────────

export const parseForm = createWholeArtifactParser<Form>('Form', FormSchema)

export const parseBundle = createWholeArtifactParser<Bundle>('Bundle', BundleSchema)

export const parseDocument = createWholeArtifactParser<Document>('Document', DocumentSchema)

export const parseChecklist = createWholeArtifactParser<Checklist>('Checklist', ChecklistSchema)

// ─────────────────────────────────────────────────────────────
// Block Parsers (Form components)
// ─────────────────────────────────────────────────────────────

export const parseFormField = createArtifactParser<FormField>('FormField', FormFieldSchema)

export const parseFormAnnex = createArtifactParser<FormAnnex>('FormAnnex', FormAnnexSchema)

export const parseFormParty = createArtifactParser<FormParty>('FormParty', FormPartySchema)

export const parseLayer = createArtifactParser<Layer>('Layer', LayerSchema)

// ─────────────────────────────────────────────────────────────
// Collection Item Parsers
// ─────────────────────────────────────────────────────────────

export const parseBundleContentItem = createArtifactParser<BundleContentItem>(
	'BundleContentItem',
	BundleContentItemSchema,
)

export const parseChecklistItem = createArtifactParser<ChecklistItem>(
	'ChecklistItem',
	ChecklistItemSchema,
)
