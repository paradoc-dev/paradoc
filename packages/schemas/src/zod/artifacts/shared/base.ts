import { z } from 'zod';
import { MetadataSchema } from '../../primitives/metadata';
import { ARTIFACT_NAME_PATTERN } from '../../primitives/name';
import { ARTIFACT_VERSION_PATTERN } from '../../primitives/version';
import { ContentRefSchema } from './content-ref';
import { ArtifactEditionSchema } from './edition';

export const ArtifactSchema = z.object({
	$schema: z.url()
		.describe('JSON Schema URI for this artifact instance.')
		.optional(),
	name: z.string()
		.min(1)
		.max(128)
		.regex(ARTIFACT_NAME_PATTERN)
		.describe('Artifact identifier. Must start with a letter or digit, can contain letters, numbers, and hyphens (no leading/trailing/consecutive hyphens). Every edition of one artifact shares the same name.'),
	version: z.string()
		.min(1)
		.max(200)
		.regex(ARTIFACT_VERSION_PATTERN)
		.describe("Artifact version (SemVer 2.0.0, such as 1.2.3 or 1.3.0-beta.1). It counts the publisher's own changes, never the issuer's edition; each edition has its own version line. Required for publishing to registry.")
		.optional(),
	title: z.string()
		.min(1)
		.max(200)
		.describe('Human-readable title. Recommended for published/shared artifacts and directory browsing.')
		.optional(),
	description: z.string()
		.min(0)
		.max(2000)
		.describe('Detailed description or context for the artifact.')
		.optional(),
	code: z.string()
		.min(1)
		.max(200)
		.describe("The form number as printed by its issuer, such as W-9 or ACORD 25, or a self-issued form's own number.")
		.optional(),
	issuer: z.string()
		.min(1)
		.max(200)
		.describe('The organization that issues the form, such as U.S. Internal Revenue Service.')
		.optional(),
	edition: ArtifactEditionSchema
		.describe("The issuer's edition this artifact encodes. Omitted for artifacts that are not issued in editions.")
		.optional(),
	language: z.string()
		.min(2)
		.max(35)
		.regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/)
		.describe('BCP 47-style source language tag for this artifact. Defaults to en when omitted.')
		.optional(),
	metadata: MetadataSchema
		.describe('Custom key-value pairs for storing domain-specific or organizational metadata')
		.optional(),
	instructions: ContentRefSchema
		.describe('Domain or compliance reference content (e.g., IRS instructions, regulatory guidance)')
		.optional(),
	agentInstructions: ContentRefSchema
		.describe('LLM/agent prompts for field ordering, grouping, tone, and presentation guidance')
		.optional(),
}).meta({
	title: 'Artifact',
	description: 'Root schema for all Paradoc artifacts (containers and documents).',
});
