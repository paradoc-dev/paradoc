import { z } from 'zod'

export const GetRegistryInputSchema = z.object({
  registryUrl: z
    .string()
    .describe('Registry base URL (e.g. https://public.paradoc.dev)'),
})

export type GetRegistryInput = z.infer<typeof GetRegistryInputSchema>
