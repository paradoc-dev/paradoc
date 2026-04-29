import { z } from 'zod'

export const GetArtifactInputSchema = z.object({
  registryUrl: z
    .string()
    .describe('Registry base URL (e.g. https://public.paradoc.dev)'),
  artifactName: z
    .string()
    .describe('Artifact name within the registry'),
})

export type GetArtifactInput = z.infer<typeof GetArtifactInputSchema>
