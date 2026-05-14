/**
 * Type inference module - compile-time type utilities and JSON schema generation
 */

export type {
  JsonSchema,
  FieldToDataType,
  FieldsToDataType,
  InferFormData,
  InferFormPayload,
} from './form-payload'

export { compile, compileToJsonSchema } from './form-payload'

export type { CompositePropertySpec, CompositeShape } from './composite-shapes'
export {
  CANONICAL_SHAPES,
  isCompositeType,
  describeCompositeShape,
} from './composite-shapes'

// Re-export InferChecklistPayload from checklist
export type { InferChecklistPayload } from '@/artifacts/checklist'
