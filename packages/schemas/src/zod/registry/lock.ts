/**
 * Lock File Schema
 *
 * Defines the schema for .paradoc/lock.json
 * Tracks installed artifacts for reproducibility.
 */

import { z } from 'zod';
import { ARTIFACT_REFERENCE_PATTERN } from '../primitives/name';
import { ArtifactOutputFormatSchema } from './registry-entry';

/**
 * Lock file integrity: `sha256-` and the base64 SHA-256 digest of the file
 * as written, the Subresource Integrity form.
 */
const LockIntegritySchema = z.string()
	.regex(/^sha256-[A-Za-z0-9+/]{43}=$/);

/**
 * Locked layer information
 */
export const LockedLayerSchema = z.object({
	integrity: LockIntegritySchema
		.describe('SHA-256 integrity of the layer file (sha256-<base64>)'),
	path: z.string().describe('Relative path to the layer file from project root'),
}).meta({
	title: 'LockedLayer',
	description: 'Information about an installed layer file',
});

/**
 * Locked artifact information
 */
export const LockedArtifactSchema = z.object({
	kind: z.enum(['form', 'document', 'checklist', 'bundle']).describe('Artifact kind'),
	version: z.string().describe('Installed artifact version'),
	resolved: z.url().describe('Full URL used to fetch the artifact'),
	integrity: LockIntegritySchema
		.describe('SHA-256 integrity of the artifact file as written (sha256-<base64>)'),
	installedAt: z.iso.datetime().describe('ISO 8601 timestamp when artifact was installed'),
	output: ArtifactOutputFormatSchema
		.describe('Output format the artifact was written in'),
	path: z.string().describe('Relative path to the artifact file from project root'),
	layers: z.record(
		z.string().describe('Layer key'),
		LockedLayerSchema,
	).describe('Installed layers and their metadata'),
}).meta({
	title: 'LockedArtifact',
	description: 'Information about an installed artifact',
});

/**
 * Lock file schema for .paradoc/lock.json
 */
export const LockFileSchema = z.object({
	$schema: z.url()
		.describe('JSON Schema URI for validation')
		.optional(),
	version: z.number()
		.default(1)
		.describe('Lock file format version'),
	artifacts: z.record(
		z.string()
			.regex(ARTIFACT_REFERENCE_PATTERN)
			.describe('Artifact reference (@namespace/name)'),
		LockedArtifactSchema,
	).describe('Installed artifacts by reference'),
}).meta({
	title: 'Paradoc Lock File',
	description: 'Schema for .paradoc/lock.json lock file',
}).strict();

/**
 * TypeScript types
 */
export type LockedLayer = z.infer<typeof LockedLayerSchema>;
export type LockedArtifact = z.infer<typeof LockedArtifactSchema>;
export type LockFile = z.infer<typeof LockFileSchema>;
