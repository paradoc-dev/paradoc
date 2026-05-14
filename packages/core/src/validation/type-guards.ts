/**
 * TypeScript-Safe Validator Wrappers
 *
 * This module provides type-safe wrappers around runtime AJV validators.
 * Validators are compiled on-demand and cached for performance.
 * We provide:
 * - Type guards: `isForm(x): x is Form`
 * - Raw validators: `validateForm(x): boolean`
 */

import type {
  Form,
  Document,
  Bundle,
  Checklist,
  FormField,
  FormAnnex,
  FormFieldset,
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
  validateFormFieldset,
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

// Alias for internal use
const _validateForm = validateForm
const _validateDocument = validateDocument
const _validateBundle = validateBundle
const _validateChecklist = validateChecklist
const _validateFormField = validateFormField
const _validateFormAnnex = validateFormAnnex
const _validateFormFieldset = validateFormFieldset
const _validateFormParty = validateFormParty
const _validateSignature = validateSignature
const _validateAttachment = validateAttachment
const _validateLayer = validateLayer
const _validateAddress = validateAddress
const _validateBbox = validateBbox
const _validateCoordinate = validateCoordinate
const _validateDuration = validateDuration
const _validateIdentification = validateIdentification
const _validateMetadata = validateMetadata
const _validateMoney = validateMoney
const _validateOrganization = validateOrganization
const _validatePerson = validatePerson
const _validatePhone = validatePhone

// =============================================================================
// Artifact Type Guards
// =============================================================================

export function isForm(value: unknown): value is Form {
  return _validateForm(value)
}

export function isDocument(value: unknown): value is Document {
  return _validateDocument(value)
}

export function isBundle(value: unknown): value is Bundle {
  return _validateBundle(value)
}

export function isChecklist(value: unknown): value is Checklist {
  return _validateChecklist(value)
}

// =============================================================================
// Block Type Guards (design-time form components)
// =============================================================================

export function isFormField(value: unknown): value is FormField {
  return _validateFormField(value)
}

export function isFormAnnex(value: unknown): value is FormAnnex {
  return _validateFormAnnex(value)
}

export function isFormFieldset(value: unknown): value is FormFieldset {
  return _validateFormFieldset(value)
}

export function isFormParty(value: unknown): value is FormParty {
  return _validateFormParty(value)
}

export function isLayer(value: unknown): value is Layer {
  return _validateLayer(value)
}

// =============================================================================
// Runtime Type Guards
// =============================================================================

/**
 * Shape-based type guard for Party.
 * Checks if value is a valid Person or Organization based on shape.
 *
 * - Organization: has org-specific keys (legalName, domicile, entityType, entityId, taxId)
 * - Person: has `name` but no org-specific keys
 */
export function isParty(value: unknown): value is Party {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  if (!('name' in obj)) return false
  const orgKeys = ['legalName', 'domicile', 'entityType', 'entityId', 'taxId']
  const hasOrgKey = Object.keys(obj).some(k => orgKeys.includes(k))
  if (hasOrgKey) return _validateOrganization(value)
  return _validatePerson(value)
}

export function isSignature(value: unknown): value is Signature {
  return _validateSignature(value)
}

export function isAttachment(value: unknown): value is Attachment {
  return _validateAttachment(value)
}

// =============================================================================
// Primitive Type Guards
// =============================================================================

export function isAddress(value: unknown): value is Address {
  return _validateAddress(value)
}

export function isBbox(value: unknown): value is Bbox {
  return _validateBbox(value)
}

export function isCoordinate(value: unknown): value is Coordinate {
  return _validateCoordinate(value)
}

export function isDuration(value: unknown): value is Duration {
  return _validateDuration(value)
}

export function isIdentification(value: unknown): value is Identification {
  return _validateIdentification(value)
}

export function isMetadata(value: unknown): value is Metadata {
  return _validateMetadata(value)
}

export function isMoney(value: unknown): value is Money {
  return _validateMoney(value)
}

export function isOrganization(value: unknown): value is Organization {
  return _validateOrganization(value)
}

export function isPerson(value: unknown): value is Person {
  return _validatePerson(value)
}

export function isPhone(value: unknown): value is Phone {
  return _validatePhone(value)
}

// =============================================================================
// Raw Validator Exports (for advanced use)
// =============================================================================

// Re-export validators directly
export {
  validateForm,
  validateDocument,
  validateBundle,
  validateChecklist,
  validateFormField,
  validateFormAnnex,
  validateFormFieldset,
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
  validateChecklistItem,
  validateBundleContentItem,
} from './validators'
