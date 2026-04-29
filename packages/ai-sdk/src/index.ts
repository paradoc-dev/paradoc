import { tool } from 'ai'
import { z } from 'zod'
import {
  ValidateArtifactInputSchema,
  ValidateInputValueSchema,
  FillInputSchema,
  RenderInputSchema,
  GetRegistryInputSchema,
  GetArtifactInputSchema,
  executeValidateArtifact,
  executeValidateInput,
  executeFill,
  executeRender,
  executeGetRegistry,
  executeGetArtifact,
  type ParadocToolsConfig,
} from '@paradoc/ai-tools'

export type { ParadocToolsConfig }
export type {
  ProxyTextRendererConfig,
  ValidateOutput,
  ValidateInputValueOutput,
  FillOutput,
  RenderOutput,
  GetRegistryOutput,
  GetArtifactOutput,
} from '@paradoc/ai-tools'

const SourceToolInputSchema = z.object({
  source: z.enum(['artifact', 'url', 'registry']).describe('Source type'),
  artifact: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Paradoc artifact JSON object (required when source is "artifact")'),
  baseUrl: z
    .string()
    .optional()
    .describe('Base URL for resolving file-backed layers (artifact source only)'),
  url: z
    .string()
    .optional()
    .describe('Artifact URL (required when source is "url")'),
  registryUrl: z
    .string()
    .optional()
    .describe('Registry base URL (required when source is "registry")'),
  artifactName: z
    .string()
    .optional()
    .describe('Artifact name within registry (required when source is "registry")'),
})

const ValidateArtifactToolInputSchema = SourceToolInputSchema.extend({
  options: z
    .object({
      schema: z.boolean().optional(),
      logic: z.boolean().optional(),
    })
    .optional()
    .describe('Validation options'),
})

const ValidateInputToolInputSchema = SourceToolInputSchema.extend({
  target: z
    .enum(['field', 'party', 'annex', 'checklistItem'])
    .describe('Validation target'),
  fieldPath: z
    .string()
    .optional()
    .describe('Field path under fields, for target="field" (for example profile.nickname)'),
  roleId: z
    .string()
    .optional()
    .describe('Party role ID, for target="party" (for example tenant)'),
  index: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Party index for target="party" (default: 0)'),
  annexId: z
    .string()
    .optional()
    .describe('Annex key, for target="annex"'),
  itemId: z
    .string()
    .optional()
    .describe('Checklist item ID, for target="checklistItem"'),
  value: z
    .unknown()
    .describe('Single value to validate against the selected target'),
})

const FillToolInputSchema = SourceToolInputSchema.extend({
  data: z
    .record(z.string(), z.unknown())
    .describe('Data to fill. Include fields under "fields" and parties by party ID.'),
})

const RenderToolInputSchema = SourceToolInputSchema.extend({
  data: z
    .record(z.string(), z.unknown())
    .describe('Data to fill before rendering.'),
  layer: z
    .string()
    .optional()
    .describe('Layer key to render. Falls back to defaultLayer, then first layer.'),
})

export function paradocTools(config?: ParadocToolsConfig) {
  return {
    validateArtifact: tool({
      description: 'Validates an Paradoc artifact against its schema',
      inputSchema: ValidateArtifactToolInputSchema,
      execute: async (input) =>
        executeValidateArtifact(ValidateArtifactInputSchema.parse(input), config),
    }),
    validateInput: tool({
      description:
        'Progressively validates a single user input against a specific artifact target. Use target="field" with fieldPath, target="party" with roleId (and optional index), target="annex" with annexId, or target="checklistItem" with itemId. Returns normalizedValue on success, or structured field errors on failure.',
      inputSchema: ValidateInputToolInputSchema,
      execute: async (input) => executeValidateInput(ValidateInputValueSchema.parse(input), config),
    }),
    fill: tool({
      description:
        'Fills an Paradoc artifact with data and validates. Always include `source` and `data`. Source-specific inputs: source="artifact" requires `artifact`; source="url" requires `url`; source="registry" requires `registryUrl` and `artifactName`. Example (registry): {"source":"registry","registryUrl":"https://public.paradoc.dev","artifactName":"purchase-agreement","data":{"fields":{"agreementDate":"2026-03-03","paymentMethod":"ach"},"parties":{"buyer":{"id":"buyer-0","name":"Alex Buyer"},"seller":{"id":"seller-0","name":"Northwind LLC"}}}}',
      inputSchema: FillToolInputSchema,
      execute: async (input) => executeFill(FillInputSchema.parse(input), config),
    }),
    render: tool({
      description:
        'Renders an Paradoc artifact to PDF, markdown, or DOCX. Always include `source` and `data`. Source-specific inputs: source="artifact" requires `artifact`; source="url" requires `url`; source="registry" requires `registryUrl` and `artifactName`. `layer` is optional. Example (registry): {"source":"registry","registryUrl":"https://public.paradoc.dev","artifactName":"purchase-agreement","data":{"fields":{"agreementDate":"2026-03-03","paymentMethod":"ach"},"parties":{"buyer":{"id":"buyer-0","name":"Alex Buyer"},"seller":{"id":"seller-0","name":"Northwind LLC"}}},"layer":"pdf"}',
      inputSchema: RenderToolInputSchema,
      execute: async (input) => executeRender(RenderInputSchema.parse(input), config),
    }),
    getRegistry: tool({
      description: 'Fetches registry.json from a URL, returns available artifacts',
      inputSchema: GetRegistryInputSchema,
      execute: async (input) => executeGetRegistry(input, config),
    }),
    getArtifact: tool({
      description: 'Fetches artifact JSON from a registry by name',
      inputSchema: GetArtifactInputSchema,
      execute: async (input) => executeGetArtifact(input, config),
    }),
  }
}
