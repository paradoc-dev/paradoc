import { z } from 'zod'
import { ArtifactSource, RegistrySource, UrlSource } from './source'

const FillDataSchema = z
  .record(z.string(), z.unknown())
  .describe(
    'Data to fill. Fields go under "fields": { fieldId: value }. Parties go under role keys (for example tenant/landlord/taxpayer): { parties: { tenant: { id: "tenant", name: "..." } } }.',
  )

export const FillInputSchema = z.discriminatedUnion('source', [
  ArtifactSource.extend({
    data: FillDataSchema,
  }),
  UrlSource.extend({
    data: FillDataSchema,
  }),
  RegistrySource.extend({
    data: FillDataSchema,
  }),
])

export type FillInput = z.infer<typeof FillInputSchema>
