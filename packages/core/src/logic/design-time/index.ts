/**
 * Design-Time Logic Module
 *
 * Provides validation and type-checking for form logic expressions during form authoring.
 * This module helps validate that logic expressions are syntactically correct and that
 * referenced variables exist in the form definition.
 *
 * @module logic/design-time
 */

// ============================================================================
// Public API - Functions
// ============================================================================

export { validateLogic } from './validation'

// ============================================================================
// Public API - Types
// ============================================================================

export type { LogicValidatableArtifact } from './validation'

// Schema types (re-export from @paradoc/types)
export type { CondExpr, DefsSection } from '@paradoc/types'
