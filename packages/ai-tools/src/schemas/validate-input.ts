import { z } from 'zod'
import { ArtifactSource, RegistrySource, UrlSource } from './source'

const ValidateInputTargetSchema = z
  .enum(['field', 'party', 'annex', 'checklistItem'])
  .describe('Validation target within the artifact')

const ValidateInputValueSchemaBase = z.object({
  target: ValidateInputTargetSchema,
  fieldPath: z
    .string()
    .optional()
    .describe('Field path under fields (for target="field"), e.g. "profile.nickname"'),
  roleId: z
    .string()
    .optional()
    .describe('Party role ID (for target="party"), e.g. "tenant"'),
  index: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Party index for multi-party roles (target="party"), default 0'),
  annexId: z
    .string()
    .optional()
    .describe('Annex key (for target="annex"), e.g. "photoId"'),
  itemId: z
    .string()
    .optional()
    .describe('Checklist item ID (for target="checklistItem")'),
  value: z
    .unknown()
    .describe('Single user-provided value to validate against the selected target'),
})

export const ValidateInputValueSchema = z.discriminatedUnion('source', [
  ArtifactSource.extend(ValidateInputValueSchemaBase.shape),
  UrlSource.extend(ValidateInputValueSchemaBase.shape),
  RegistrySource.extend(ValidateInputValueSchemaBase.shape),
])

export type ValidateInputValue = z.infer<typeof ValidateInputValueSchema>
