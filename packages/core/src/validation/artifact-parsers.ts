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
import type { ZodType } from 'zod'
import { assertCurrentSchemaVersion } from '@/serialization/schema-version'
import { createParser } from './zod-parser'

/**
 * Factory for a whole-artifact parser. Every artifact entry point parses
 * through one of these, so each holds the input to the current schema version
 * before the schema: an object may leave out `$schema`, as one built in memory
 * does, but one it declares must be current, on the root and on every inline
 * bundle part. Only `migrate` accepts another version.
 */
function createWholeArtifactParser<T>(schemaName: string, schema: ZodType<T>): (input: unknown) => T {
	const parseSchema = createParser(schemaName, schema)
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

export const parseFormField = createParser<FormField>('FormField', FormFieldSchema)

export const parseFormAnnex = createParser<FormAnnex>('FormAnnex', FormAnnexSchema)

export const parseFormParty = createParser<FormParty>('FormParty', FormPartySchema)

export const parseLayer = createParser<Layer>('Layer', LayerSchema)

// ─────────────────────────────────────────────────────────────
// Collection Item Parsers
// ─────────────────────────────────────────────────────────────

export const parseBundleContentItem = createParser<BundleContentItem>(
	'BundleContentItem',
	BundleContentItemSchema,
)

export const parseChecklistItem = createParser<ChecklistItem>(
	'ChecklistItem',
	ChecklistItemSchema,
)
