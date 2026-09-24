/**
 * Type inference module - compile-time type utilities and JSON schema generation
 */

export type {
  JsonSchema,
  FieldToDataType,
  FieldsToDataType,
  InferFormData,
  InferFormPayload,
  DeepPartial,
  ProgressiveFormPayload,
} from './form-payload'

export { compile } from './form-payload'

export type { CompositePropertySpec, CompositeShape, CompositeValueType } from './composite-shapes'
export {
  CANONICAL_SHAPES,
  isCompositeType,
  describeCompositeShape,
} from './composite-shapes'

// Re-export InferChecklistPayload from checklist
export type { InferChecklistPayload } from '@/artifacts/checklist'
