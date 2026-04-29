import { z } from 'zod'
import { ArtifactSource, RegistrySource, UrlSource } from './source'

const ValidateOptionsSchema = z
  .object({
    schema: z
      .boolean()
      .optional()
      .describe('Validate schema structure (default: true)'),
    logic: z
      .boolean()
      .optional()
      .describe('Validate logic expressions (default: true)'),
  })
  .optional()
  .describe('Validation options')

export const ValidateArtifactInputSchema = z.discriminatedUnion('source', [
  ArtifactSource.extend({
    options: ValidateOptionsSchema,
  }),
  UrlSource.extend({
    options: ValidateOptionsSchema,
  }),
  RegistrySource.extend({
    options: ValidateOptionsSchema,
  }),
])

export type ValidateArtifactInput = z.infer<typeof ValidateArtifactInputSchema>
