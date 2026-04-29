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
	FormFieldset,
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
	FormFieldsetSchema,
	FormPartySchema,
	LayerSchema,
	BundleContentItemSchema,
	ChecklistItemSchema,
} from '@paradoc/schemas'
import { type ZodType, type ZodError } from 'zod'

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

// ─────────────────────────────────────────────────────────────
// Artifact Parsers
// ─────────────────────────────────────────────────────────────

export const parseForm = createArtifactParser<Form>('Form', FormSchema)

export const parseBundle = createArtifactParser<Bundle>('Bundle', BundleSchema)

export const parseDocument = createArtifactParser<Document>('Document', DocumentSchema)

export const parseChecklist = createArtifactParser<Checklist>('Checklist', ChecklistSchema)

// ─────────────────────────────────────────────────────────────
// Block Parsers (Form components)
// ─────────────────────────────────────────────────────────────

export const parseFormField = createArtifactParser<FormField>('FormField', FormFieldSchema)

export const parseFormAnnex = createArtifactParser<FormAnnex>('FormAnnex', FormAnnexSchema)

export const parseFormFieldset = createArtifactParser<FormFieldset>('FormFieldset', FormFieldsetSchema)

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
