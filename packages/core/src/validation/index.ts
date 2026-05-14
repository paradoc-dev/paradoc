/**
 * Validation module - type guards, validators, coercion
 */

// Zod validators
export {
  validateForm,
  validateDocument,
  validateBundle,
  validateChecklist,
  validateFormField,
  validateFormAnnex,
  validateFormFieldset,
  validateFormParty,
  validateLayer,
  validateChecklistItem,
  validateBundleContentItem,
  validateSignature,
  validateAttachment,
  validateAddress,
  validateBbox,
  validateCoordinate,
  validateDuration,
  validateIdentification,
  validateMetadata,
  validateMoney,
  validateOrganization,
  validatePerson,
  validatePhone,
  getValidatorErrors,
} from './validators'
export type { ValidatorError } from './validators'

// Type guards
export {
  isForm,
  isDocument,
  isBundle,
  isChecklist,
  isFormField,
  isFormAnnex,
  isFormFieldset,
  isFormParty,
  isLayer,
  isParty,
  isSignature,
  isAttachment,
  isAddress,
  isBbox,
  isCoordinate,
  isDuration,
  isIdentification,
  isMetadata,
  isMoney,
  isOrganization,
  isPerson,
  isPhone,
} from './type-guards'

// Party validation
export {
  validatePartyForRole,
  isPartyTypeAllowed,
  isPerson as isPersonParty,
  isOrganization as isOrganizationParty,
  inferPartyType,
  expectsArrayFormat,
  validatePartyId,
  validatePartiesForRole,
} from './party'
export type { PartyValidationResult, ExtendedValidationResult } from './party'

// Artifact validation
export { validateSchema, validate as validateArtifact, parseArtifact } from './artifact'

// Data validation
export { validateFormData, validateInstance } from './data'

// Progressive validation
export {
  validateFieldInput,
  validateFieldsPatch,
  validatePartyInput,
  validatePartiesPatch,
  validateAnnexInput,
  validateAnnexesPatch,
  validateChecklistItemInput,
  validateChecklistItemsPatch,
} from './progressive'
export type {
  ProgressiveValidationResult,
  FieldInputValidationInput,
  PartyInputValidationInput,
  AnnexInputValidationInput,
  ChecklistItemInputValidationInput,
  NormalizedPartyInput,
} from './progressive'

// Types
export type {
  ValidationError,
  ValidationSuccess,
  ValidationFailure,
  ValidationResult,
  ValidateOptions,
} from '@/types'

// Zod schemas re-exported from @paradoc/schemas
export {
  FormSchema,
  DocumentSchema,
  BundleSchema,
  ChecklistSchema,
} from '@paradoc/schemas'

// Primitive parsers (ready-to-use parse functions)
export {
  parseAddress,
  parseBbox,
  parseCoordinate,
  parseDuration,
  parseIdentification,
  parseMetadata,
  parseMoney,
  parseOrganization,
  parsePerson,
  parsePhone,
} from './parsers'

// Artifact parsers (ready-to-use parse functions for artifacts and blocks)
export {
  parseForm,
  parseBundle,
  parseDocument,
  parseChecklist,
  parseFormField,
  parseFormAnnex,
  parseFormFieldset,
  parseFormParty,
  parseLayer,
  parseBundleContentItem,
  parseChecklistItem,
} from './artifact-parsers'
