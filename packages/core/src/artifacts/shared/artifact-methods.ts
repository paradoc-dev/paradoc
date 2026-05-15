/**
 * Artifact Methods - Shared functionality via composition
 *
 * This replaces BaseArtifactInstance inheritance with composition.
 * All artifact instances use withArtifactMethods() to get common functionality.
 */

import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { Artifact, Metadata, ContentRef } from '@paradoc/types'
import { validate as validateArtifact } from '@/validation/artifact'
import { toYAML } from '@/serialization/serialization'
import { PARADOC_SCHEMA_URL } from '@paradoc/schemas'
import type { ValidateOptions, SerializationOptions } from '@/types'

/**
 * Common artifact methods interface
 */
export interface ArtifactMethods<T extends Artifact> {
	/** Internal data access */
	readonly _data: T

	/** Artifact kind discriminator */
	readonly kind: T['kind']

	/** Artifact name (required) */
	readonly name: string

	/** Artifact version */
	readonly version: string | undefined

	/** Human-readable title */
	readonly title: string | undefined

	/** Description */
	readonly description: string | undefined

	/** Artifact code */
	readonly code: string | undefined

	/** Artifact source language */
	readonly language: string | undefined

	/** Release date (ISO 8601) */
	readonly releaseDate: string | undefined

	/** Custom metadata */
	readonly metadata: Metadata | undefined

	/** Domain or compliance reference content */
	readonly instructions: ContentRef | undefined

	/** LLM/agent prompts for presentation guidance */
	readonly agentInstructions: ContentRef | undefined

	/**
	 * Validates the artifact schema definition.
	 * Returns a Standard Schema result with either `value` or `issues`.
	 */
	validate(options?: ValidateOptions): StandardSchemaV1.Result<T>

	/**
	 * Checks if the artifact schema definition is valid.
	 * Returns true if valid, false otherwise.
	 */
	isValid(options?: ValidateOptions): boolean

	/**
	 * Serialize to JSON object.
	 * Optionally includes $schema property for IDE validation.
	 */
	toJSON(options?: SerializationOptions): T | (T & { $schema: string })

	/**
	 * Serialize to YAML string.
	 * Optionally includes schema comment.
	 */
	toYAML(options?: SerializationOptions): string
}

/**
 * Creates an object with common artifact methods.
 * Use this via composition instead of class inheritance.
 *
 * @param data - The artifact data
 * @returns Object with common artifact properties and methods
 *
 * @example
 * ```typescript
 * function createDocumentInstance(doc: Document) {
 *   return {
 *     ...withArtifactMethods(doc),
 *     // Document-specific methods...
 *     prepare() { ... },
 *   }
 * }
 * ```
 */
export function withArtifactMethods<T extends Artifact>(data: T): ArtifactMethods<T> {
	return {
		_data: data,

		// Direct property access
		kind: data.kind,
		name: data.name,
		version: data.version,
		title: data.title,
		description: data.description,
		code: data.code,
		language: data.language,
		releaseDate: data.releaseDate,
		metadata: data.metadata,
		instructions: data.instructions,
		agentInstructions: data.agentInstructions,

		// Validation
		validate(options?: ValidateOptions): StandardSchemaV1.Result<T> {
			return validateArtifact<T>(data, options)
		},

		isValid(options?: ValidateOptions): boolean {
			const result = this.validate(options)
			return !('issues' in result)
		},

		// Serialization
		toJSON(options: SerializationOptions = {}): T | (T & { $schema: string }) {
			const { includeSchema = true } = options
			if (includeSchema) {
				return { $schema: PARADOC_SCHEMA_URL, ...data } as T & { $schema: string }
			}
			return data
		},

		toYAML(options: SerializationOptions = {}): string {
			return toYAML(data, options)
		},
	}
}
