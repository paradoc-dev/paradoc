/**
 * Serialization & Loading
 * 
 * This module handles:
 * - YAML/JSON serialization (toYAML, fromYAML, parse)
 * - Artifact loading from strings/objects (load, loadFromObject)
 * - Error handling (SerializationError, LoadError)
 */

// ============================================================================
// Serialization - YAML/JSON conversion
// ============================================================================

export {
  toYAML,
  fromYAML,
  parse,
  SerializationError,
} from './serialization'

export type {
  SerializationFormat,
  SerializationOptions,
} from './serialization'

// ============================================================================
// Loading - Artifact instantiation from strings/objects
// ============================================================================

export {
  load,
  loadFromObject,
  safeLoad,
  safeLoadFromObject,
  LoadError,
  // Type guards for artifact instances
  isFormInstance,
  isDocumentInstance,
  isBundleInstance,
  isChecklistInstance,
} from './load'

export type {
  AnyArtifactInstance,
} from './load'
