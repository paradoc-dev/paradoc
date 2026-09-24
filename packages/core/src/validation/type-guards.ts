/**
 * Type guards over the runtime validators: `isForm(x): x is Form` holds when
 * `validateForm(x)` reports no issues.
 */

import type {
  Form,
  Document,
  Bundle,
  Checklist,
  FormField,
  FormAnnex,
  FormParty,
  Party,
  Signature,
  Attachment,
  Address,
  Bbox,
  Coordinate,
  Duration,
  Identification,
  Metadata,
  Money,
  Organization,
  Person,
  Phone,
  Layer,
} from '@paradoc/types'
import {
  validateForm,
  validateDocument,
  validateBundle,
  validateChecklist,
  validateFormField,
  validateFormAnnex,
  validateFormParty,
  validateSignature,
  validateAttachment,
  validateLayer,
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

import { checkParty } from '@/primitives/party'

// =============================================================================
// Artifact Type Guards
// =============================================================================

export function isForm(value: unknown): value is Form {
  return !validateForm(value).issues
}

export function isDocument(value: unknown): value is Document {
  return !validateDocument(value).issues
}

export function isBundle(value: unknown): value is Bundle {
  return !validateBundle(value).issues
}

export function isChecklist(value: unknown): value is Checklist {
  return !validateChecklist(value).issues
}

// =============================================================================
// Block Type Guards (design-time form components)
// =============================================================================

export function isFormField(value: unknown): value is FormField {
  return !validateFormField(value).issues
}

export function isFormAnnex(value: unknown): value is FormAnnex {
  return !validateFormAnnex(value).issues
}

export function isFormParty(value: unknown): value is FormParty {
  return !validateFormParty(value).issues
}

export function isLayer(value: unknown): value is Layer {
  return !validateLayer(value).issues
}

// =============================================================================
// Runtime Type Guards
// =============================================================================

/**
 * Type guard for Party: a valid Person or Organization, the type inferred
 * from shape as `checkParty` infers it.
 */
export function isParty(value: unknown): value is Party {
  return checkParty(value).success
}

export function isSignature(value: unknown): value is Signature {
  return !validateSignature(value).issues
}

export function isAttachment(value: unknown): value is Attachment {
  return !validateAttachment(value).issues
}

// =============================================================================
// Primitive Type Guards
// =============================================================================

export function isAddress(value: unknown): value is Address {
  return !validateAddress(value).issues
}

export function isBbox(value: unknown): value is Bbox {
  return !validateBbox(value).issues
}

export function isCoordinate(value: unknown): value is Coordinate {
  return !validateCoordinate(value).issues
}

export function isDuration(value: unknown): value is Duration {
  return !validateDuration(value).issues
}

export function isIdentification(value: unknown): value is Identification {
  return !validateIdentification(value).issues
}

export function isMetadata(value: unknown): value is Metadata {
  return !validateMetadata(value).issues
}

export function isMoney(value: unknown): value is Money {
  return !validateMoney(value).issues
}

export function isOrganization(value: unknown): value is Organization {
  return !validateOrganization(value).issues
}

export function isPerson(value: unknown): value is Person {
  return !validatePerson(value).issues
}

export function isPhone(value: unknown): value is Phone {
  return !validatePhone(value).issues
}
