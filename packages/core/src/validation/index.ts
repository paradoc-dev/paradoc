/**
 * Validation module: validators, type guards, parsers
 */

// Validators
export {
  validateForm,
  validateDocument,
  validateBundle,
  validateChecklist,
  validateFormField,
  validateFormAnnex,
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
} from './validators'
export type { Validator } from './validators'

// Type guards
export {
  isForm,
  isDocument,
  isBundle,
  isChecklist,
  isFormField,
  isFormAnnex,
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
export { inferPartyType } from '@/primitives/party'
export {
  validatePartyForRole,
  isPartyTypeAllowed,
  expectsArrayFormat,
  validatePartyId,
  validatePartiesForRole,
} from './party'
export type { PartyValidationResult, ExtendedValidationResult } from './party'

// Artifact validation
export { validate as validateArtifact, validateLayers, parseArtifact } from './artifact'
export type { LayerValidationIssue, ValidateLayersOptions, ValidateLayersResult } from './artifact'

// Data validation
export { validateFormData } from './data'

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
  parseFormParty,
  parseLayer,
  parseBundleContentItem,
  parseChecklistItem,
} from './artifact-parsers'
