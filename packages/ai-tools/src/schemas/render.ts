import { z } from 'zod'
import { ArtifactSource, RegistrySource, UrlSource } from './source'

const RenderDataSchema = z
  .record(z.string(), z.unknown())
  .describe(
    'Data to fill before rendering. Use the same structure as fill: { fields: { fieldId: value }, parties: { partyRole: { id, name, ... } } }.',
  )

const RenderLayerSchema = z
  .string()
  .optional()
  .describe('Layer key to render. Falls back to defaultLayer, then first layer.')

export const RenderInputSchema = z.discriminatedUnion('source', [
  ArtifactSource.extend({
    data: RenderDataSchema,
    layer: RenderLayerSchema,
  }),
  UrlSource.extend({
    data: RenderDataSchema,
    layer: RenderLayerSchema,
  }),
  RegistrySource.extend({
    data: RenderDataSchema,
    layer: RenderLayerSchema,
  }),
])

export type RenderInput = z.infer<typeof RenderInputSchema>
