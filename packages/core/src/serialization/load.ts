import type { Form, Document, Bundle, Checklist } from '@paradoc/types'
import { parse } from './serialization'
import { form, type FormInstance } from '@/artifacts/form'
import { document, type DocumentInstance } from '@/artifacts/document'
import { bundle, type BundleInstance } from '@/artifacts/bundle'
import { checklist, type ChecklistInstance } from '@/artifacts/checklist'

// ============================================================================
// Type definitions
// ============================================================================

/**
 * Union of all artifact instance types with proper discriminators
 */
export type AnyArtifactInstance =
  | FormInstance<Form>
  | DocumentInstance<Document>
  | BundleInstance<Bundle>
  | ChecklistInstance<Checklist>

/**
 * Error thrown when loading an artifact fails
 */
export class LoadError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message)
    this.name = 'LoadError'
  }
}

// ============================================================================
// Type guards for runtime discrimination
// ============================================================================

/**
 * Type guard to check if an instance is a FormInstance
 */
export function isFormInstance(instance: AnyArtifactInstance): instance is FormInstance<Form> {
  return instance.kind === 'form'
}

/**
 * Type guard to check if an instance is a DocumentInstance
 */
export function isDocumentInstance(instance: AnyArtifactInstance): instance is DocumentInstance<Document> {
  return instance.kind === 'document'
}

/**
 * Type guard to check if an instance is a BundleInstance
 */
export function isBundleInstance(instance: AnyArtifactInstance): instance is BundleInstance<Bundle> {
  return instance.kind === 'bundle'
}

/**
 * Type guard to check if an instance is a ChecklistInstance
 */
export function isChecklistInstance(instance: AnyArtifactInstance): instance is ChecklistInstance<Checklist> {
  return instance.kind === 'checklist'
}

// ============================================================================
// Load Functions
// ============================================================================

/**
 * Load an artifact from a string (YAML or JSON).
 * Auto-detects the format and parses the content, returning the appropriate
 * artifact instance based on the `kind` field.
 *
 * You can optionally specify the expected kind as a generic parameter for
 * compile-time type inference, or omit it and use runtime type narrowing.
 *
 * @param content - YAML or JSON string containing the artifact definition
 * @returns An artifact instance (FormInstance, DocumentInstance, BundleInstance, or ChecklistInstance)
 * @throws LoadError if parsing fails or the artifact kind is unknown
 *
 * @example
 * ```typescript
 * import { load } from '@paradoc/core'
 *
 * // With generic parameter - compile-time typing
 * const checklist = load<'checklist'>(fileContents)
 * checklist.items // ✅ TypeScript knows this is ChecklistInstance
 *
 * // Without generic - runtime type narrowing
 * const artifact = load(fileContents)
 * if (artifact.kind === 'checklist') {
 *   artifact.items // ✅ TypeScript narrows the type here
 * }
 * ```
 */
export function load<_K extends 'form'>(content: string): FormInstance<Form>;
export function load<_K extends 'document'>(content: string): DocumentInstance<Document>;
export function load<_K extends 'bundle'>(content: string): BundleInstance<Bundle>;
export function load<_K extends 'checklist'>(content: string): ChecklistInstance<Checklist>;
export function load(content: string): AnyArtifactInstance;
export function load(content: string): AnyArtifactInstance {
  let parsed: unknown

  try {
    parsed = parse(content)
  } catch (err) {
    throw new LoadError(
      'Failed to parse content as YAML or JSON',
      err instanceof Error ? err : new Error(String(err))
    )
  }

  return loadFromObject(parsed)
}

/**
 * Load an artifact from a parsed object.
 * Returns the appropriate artifact instance based on the `kind` field.
 *
 * You can optionally specify the expected kind as a generic parameter for
 * compile-time type inference, or rely on type inference from the object's
 * literal `kind` type, or use runtime type narrowing.
 *
 * @param obj - A parsed object containing the artifact definition
 * @returns An artifact instance (FormInstance, DocumentInstance, etc.)
 * @throws LoadError if the object is invalid or the artifact kind is unknown
 *
 * @example
 * ```typescript
 * import { loadFromObject } from '@paradoc/core'
 *
 * // With generic parameter - compile-time typing
 * const parsed = JSON.parse(fileContents)
 * const checklist = loadFromObject<'checklist'>(parsed)
 * checklist.items // ✅ TypeScript knows this is ChecklistInstance
 *
 * // With literal kind type - automatic inference
 * const obj = { kind: 'form' as const, name: 'my-form', version: '1.0.0' }
 * const form = loadFromObject(obj) // TypeScript infers FormInstance<Form>
 * ```
 */
export function loadFromObject<_K extends 'form'>(obj: unknown): FormInstance<Form>;
export function loadFromObject<_K extends 'document'>(obj: unknown): DocumentInstance<Document>;
export function loadFromObject<_K extends 'bundle'>(obj: unknown): BundleInstance<Bundle>;
export function loadFromObject<_K extends 'checklist'>(obj: unknown): ChecklistInstance<Checklist>;
export function loadFromObject<T extends { kind: 'form' }>(obj: T): FormInstance<Form>;
export function loadFromObject<T extends { kind: 'document' }>(obj: T): DocumentInstance<Document>;
export function loadFromObject<T extends { kind: 'bundle' }>(obj: T): BundleInstance<Bundle>;
export function loadFromObject<T extends { kind: 'checklist' }>(obj: T): ChecklistInstance<Checklist>;
export function loadFromObject(obj: unknown): AnyArtifactInstance;
export function loadFromObject(obj: unknown): AnyArtifactInstance {
  if (!obj || typeof obj !== 'object') {
    throw new LoadError('Invalid artifact: expected an object')
  }

  if (!('kind' in obj) || typeof obj.kind !== 'string') {
    throw new LoadError('Invalid artifact: missing or invalid "kind" field')
  }

  const kind = obj.kind

  try {
    switch (kind) {
      case 'form':
        return form.from(obj) as FormInstance<Form>

      case 'document':
        return document.from(obj) as DocumentInstance<Document>

      case 'bundle':
        return bundle.from(obj) as BundleInstance<Bundle>

      case 'checklist':
        return checklist.from(obj) as ChecklistInstance<Checklist>

      default:
        throw new LoadError(`Unknown artifact kind: "${kind}"`)
    }
  } catch (err) {
    if (err instanceof LoadError) {
      throw err
    }
    throw new LoadError(
      `Failed to load ${kind} artifact: ${err instanceof Error ? err.message : String(err)}`,
      err instanceof Error ? err : undefined
    )
  }
}

/**
 * Safely load an artifact from a string (YAML or JSON).
 * Returns a result object instead of throwing.
 *
 * You can optionally specify the expected kind as a generic parameter for
 * compile-time type inference, or omit it and use runtime type narrowing.
 *
 * @param content - YAML or JSON string containing the artifact definition
 * @returns A result object with success status and either the artifact or error
 *
 * @example
 * ```typescript
 * import { safeLoad } from '@paradoc/core'
 *
 * // With generic parameter - compile-time typing
 * const result = safeLoad<'checklist'>(fileContents)
 * if (result.success) {
 *   result.data.items // ✅ TypeScript knows this is ChecklistInstance
 * }
 *
 * // Without generic - runtime type narrowing
 * const result = safeLoad(fileContents)
 * if (result.success && result.data.kind === 'checklist') {
 *   result.data.items // ✅ TypeScript narrows the type here
 * }
 * ```
 */
export function safeLoad<_K extends 'form'>(
  content: string
): { success: true; data: FormInstance<Form> } | { success: false; error: LoadError };
export function safeLoad<_K extends 'document'>(
  content: string
): { success: true; data: DocumentInstance<Document> } | { success: false; error: LoadError };
export function safeLoad<_K extends 'bundle'>(
  content: string
): { success: true; data: BundleInstance<Bundle> } | { success: false; error: LoadError };
export function safeLoad<_K extends 'checklist'>(
  content: string
): { success: true; data: ChecklistInstance<Checklist> } | { success: false; error: LoadError };
export function safeLoad(
  content: string
): { success: true; data: AnyArtifactInstance } | { success: false; error: LoadError };
export function safeLoad(
  content: string
): { success: true; data: AnyArtifactInstance } | { success: false; error: LoadError } {
  try {
    const artifact = load(content)
    return { success: true, data: artifact }
  } catch (err) {
    const error = err instanceof LoadError ? err : new LoadError(String(err), err instanceof Error ? err : undefined)
    return { success: false, error }
  }
}

/**
 * Safely load an artifact from a parsed object.
 * Returns a result object instead of throwing.
 *
 * You can optionally specify the expected kind as a generic parameter for
 * compile-time type inference, or rely on type inference from the object's
 * literal `kind` type, or use runtime type narrowing.
 *
 * @param obj - A parsed object containing the artifact definition
 * @returns A result object with success status and either the artifact or error
 *
 * @example
 * ```typescript
 * import { safeLoadFromObject } from '@paradoc/core'
 *
 * // With generic parameter - compile-time typing
 * const parsed = JSON.parse(fileContents)
 * const result = safeLoadFromObject<'checklist'>(parsed)
 * if (result.success) {
 *   result.data.items // ✅ TypeScript knows this is ChecklistInstance
 * }
 *
 * // With literal kind type - automatic inference
 * const obj = { kind: 'checklist' as const, name: 'my-list', version: '1.0.0' }
 * const result = safeLoadFromObject(obj)
 * if (result.success) {
 *   result.data.items // ✅ TypeScript infers ChecklistInstance
 * }
 * ```
 */
export function safeLoadFromObject<_K extends 'form'>(
  obj: unknown
): { success: true; data: FormInstance<Form> } | { success: false; error: LoadError };
export function safeLoadFromObject<_K extends 'document'>(
  obj: unknown
): { success: true; data: DocumentInstance<Document> } | { success: false; error: LoadError };
export function safeLoadFromObject<_K extends 'bundle'>(
  obj: unknown
): { success: true; data: BundleInstance<Bundle> } | { success: false; error: LoadError };
export function safeLoadFromObject<_K extends 'checklist'>(
  obj: unknown
): { success: true; data: ChecklistInstance<Checklist> } | { success: false; error: LoadError };
export function safeLoadFromObject<T extends { kind: 'form' }>(
  obj: T
): { success: true; data: FormInstance<Form> } | { success: false; error: LoadError };
export function safeLoadFromObject<T extends { kind: 'document' }>(
  obj: T
): { success: true; data: DocumentInstance<Document> } | { success: false; error: LoadError };
export function safeLoadFromObject<T extends { kind: 'bundle' }>(
  obj: T
): { success: true; data: BundleInstance<Bundle> } | { success: false; error: LoadError };
export function safeLoadFromObject<T extends { kind: 'checklist' }>(
  obj: T
): { success: true; data: ChecklistInstance<Checklist> } | { success: false; error: LoadError };
export function safeLoadFromObject(
  obj: unknown
): { success: true; data: AnyArtifactInstance } | { success: false; error: LoadError };
export function safeLoadFromObject(
  obj: unknown
): { success: true; data: AnyArtifactInstance } | { success: false; error: LoadError } {
  try {
    const artifact = loadFromObject(obj)
    return { success: true, data: artifact }
  } catch (err) {
    const error = err instanceof LoadError ? err : new LoadError(String(err), err instanceof Error ? err : undefined)
    return { success: false, error }
  }
}
