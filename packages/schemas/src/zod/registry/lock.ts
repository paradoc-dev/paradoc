/**
 * Lock File Schema
 *
 * Defines the schema for .paradoc/lock.json
 * Tracks installed artifacts for reproducibility.
 */

import { z } from 'zod';

/**
 * Locked layer information
 */
export const LockedLayerSchema = z.object({
	integrity: z.string()
		.regex(/^sha256:[a-f0-9]{64}$/)
		.describe('SHA-256 integrity hash of the layer file'),
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
	integrity: z.string()
		.regex(/^sha256:[a-f0-9]{64}$/)
		.describe('SHA-256 integrity hash of the artifact JSON'),
	installedAt: z.iso.datetime().describe('ISO 8601 timestamp when artifact was installed'),
	format: z.union([z.literal('json'), z.literal('yaml')])
		.describe('Format the artifact was saved in'),
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
			.regex(/^@[a-zA-Z0-9][a-zA-Z0-9-_]*\/[a-zA-Z0-9][a-zA-Z0-9-_]*$/)
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
