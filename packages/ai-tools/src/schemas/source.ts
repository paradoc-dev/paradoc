import { z } from 'zod'

export const ArtifactSource = z.object({
  source: z.literal('artifact'),
  artifact: z
    .record(z.string(), z.unknown())
    .describe('Paradoc artifact JSON object'),
  baseUrl: z
    .string()
    .optional()
    .describe('Base URL for resolving file-backed layers'),
})

export const UrlSource = z.object({
  source: z.literal('url'),
  url: z
    .string()
    .describe('URL to an Paradoc artifact JSON file'),
})

export const RegistrySource = z.object({
  source: z.literal('registry'),
  registryUrl: z
    .string()
    .describe('Registry base URL (e.g. https://public.paradoc.dev)'),
  artifactName: z
    .string()
    .describe('Artifact name within the registry'),
})

export const SourceUnion = z.discriminatedUnion('source', [ArtifactSource, UrlSource, RegistrySource])

export type SourceInput = z.infer<typeof SourceUnion>
