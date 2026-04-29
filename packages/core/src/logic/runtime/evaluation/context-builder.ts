/**
 * Builds evaluation context from form definitions and data.
 *
 * The evaluation context structures field values and defs keys
 * in a format suitable for expression evaluation.
 */

import type {
  Form,
  FormField,
  FieldsetField,
  Party,
  Signature,
  Expression,
  DefsSection,
  ScalarExpressionType,
} from '@paradoc/types'
import { inferPartyType } from '@/primitives/party'
import type { EvaluationContext, NestedFieldValues, PartyContextEntry } from './types'
import { topologicalSortDefsKeys } from '../../design-time/type-checking/build-type-environment'
import { evaluateExpressionOrDefault } from './expression-evaluator'

/** Scalar expression types (value is a string expression) */
const SCALAR_EXPRESSION_TYPES: Set<string> = new Set([
  'boolean',
  'string',
  'number',
  'integer',
  'percentage',
  'rating',
  'date',
  'time',
  'datetime',
  'duration',
])

/**
 * Check if an expression type is a scalar type.
 */
function isScalarExpressionType(type: string): type is ScalarExpressionType {
  return SCALAR_EXPRESSION_TYPES.has(type)
}

/**
 * Data payload structure (matches form data shape).
 */
export interface FormDataPayload {
  fields?: Record<string, unknown>
  annexes?: Record<string, unknown>
  parties?: Record<string, Party | Party[]>
  witnesses?: Party[]
  signatures?: Record<string, Signature | Signature[]>
}

/**
 * Recursively builds the fields context structure from flat field data.
 *
 * Handles nested fieldsets by creating nested objects:
 * - Simple field: { age: 25 }
 * - Object field: { rent: { amount: 1000, currency: 'USD' } }
 * - Fieldset: { address: { street: '123 Main', city: 'NYC' } }
 *
 * @param fields - Field definitions from the form
 * @param data - Flat field data (may have dot-notation keys or nested objects)
 * @returns Structured field values object
 */
function buildFieldsContext(
  fields: Record<string, FormField> | undefined,
  data: Record<string, unknown> | undefined
): NestedFieldValues {
  const result: NestedFieldValues = {}

  if (!fields || !data) {
    return result
  }

  for (const [fieldId, field] of Object.entries(fields)) {
    if (field.type === 'fieldset') {
      // Fieldset: recursively build nested context
      const fieldset = field as FieldsetField
      const nestedData = data[fieldId]

      if (typeof nestedData === 'object' && nestedData !== null) {
        // Nested object data
        result[fieldId] = buildFieldsContext(fieldset.fields, nestedData as Record<string, unknown>)
      } else {
        // Try dot-notation keys in flat data
        const flatNestedData: Record<string, unknown> = {}
        const dotPrefix = `${fieldId}.`
        for (const [key, value] of Object.entries(data)) {
          if (key.startsWith(dotPrefix)) {
            flatNestedData[key.slice(dotPrefix.length)] = value
          }
        }
        result[fieldId] = buildFieldsContext(fieldset.fields, flatNestedData)
      }
    } else {
      // Simple field: store value directly (no wrapper)
      result[fieldId] = data[fieldId]
    }
  }

  return result
}

/**
 * Converts a Party to a PartyContextEntry for evaluation.
 * Party type is inferred from shape using inferPartyType.
 *
 * @param party - The party data
 * @param hasSigned - Whether the party has signed
 */
function partyToContextEntry(party: Party, hasSigned: boolean): PartyContextEntry {
  return {
    type: inferPartyType(party),
    data: party,
    signed: hasSigned,
  }
}

/**
 * Gets the signature count for a role.
 */
function getSignatureCount(
  signatures: Record<string, Signature | Signature[]> | undefined,
  roleId: string
): number {
  if (!signatures) return 0
  const s = signatures[roleId]
  if (!s) return 0
  return Array.isArray(s) ? s.length : 1
}

/**
 * Builds the parties context from party data.
 * Normalizes single parties to arrays for consistent access in expressions.
 *
 * @param parties - Party data indexed by role ID
 * @param signatures - Signatures indexed by role ID
 * @returns Parties context with arrays of PartyContextEntry
 */
function buildPartiesContext(
  parties: Record<string, Party | Party[]> | undefined,
  signatures: Record<string, Signature | Signature[]> | undefined
): Record<string, PartyContextEntry[]> {
  const result: Record<string, PartyContextEntry[]> = {}

  if (!parties) {
    return result
  }

  for (const [roleId, partyData] of Object.entries(parties)) {
    const sigCount = getSignatureCount(signatures, roleId)
    if (Array.isArray(partyData)) {
      // For multiple parties, mark as signed based on signature count
      result[roleId] = partyData.map((party, index) =>
        partyToContextEntry(party, index < sigCount)
      )
    } else {
      result[roleId] = [partyToContextEntry(partyData, sigCount > 0)]
    }
  }

  return result
}

/**
 * Builds the witnesses context from witness data.
 *
 * @param witnesses - Array of witness parties
 * @param witnessSignatures - Array of witness signatures
 * @returns Array of PartyContextEntry
 */
function buildWitnessesContext(
  witnesses: Party[] | undefined,
  witnessSignatures: Signature[] | undefined
): PartyContextEntry[] {
  if (!witnesses) {
    return []
  }
  const sigCount = witnessSignatures?.length ?? 0
  return witnesses.map((witness, index) =>
    partyToContextEntry(witness, index < sigCount)
  )
}

/**
 * Evaluates a single defs expression.
 *
 * For scalar types, evaluates the single expression string.
 * For object types, evaluates each property expression and constructs the result object.
 *
 * @param expr - The expression to evaluate
 * @param context - The evaluation context
 * @returns The evaluated value
 */
function evaluateDefsExpression(
  expr: Expression,
  context: EvaluationContext
): unknown {
  if (isScalarExpressionType(expr.type)) {
    // Scalar type: value is a single expression string
    return evaluateExpressionOrDefault(expr.value as string, context, undefined)
  }

  // Object type: value is an object with expression strings for each property
  const valueObj = expr.value as unknown as Record<string, string | undefined>
  const result: Record<string, unknown> = {}

  for (const [propKey, propExpr] of Object.entries(valueObj)) {
    if (propExpr !== undefined) {
      result[propKey] = evaluateExpressionOrDefault(propExpr, context, undefined)
    }
  }

  return result
}

/**
 * Extracts expression strings from a DefsSection for dependency sorting.
 *
 * For scalar types, returns the value directly.
 * For object types, concatenates all property expressions.
 *
 * @param defs - The defs section
 * @returns Record of key → expression string(s) for sorting
 */
function extractExpressionsForSorting(defs: DefsSection): Record<string, string> {
  const result: Record<string, string> = {}

  for (const [key, expr] of Object.entries(defs)) {
    if (isScalarExpressionType(expr.type)) {
      // Scalar: value is the expression string
      result[key] = expr.value as string
    } else {
      // Object: concatenate all property expressions for dependency detection
      // Use ' and ' as delimiter to create a valid parseable expression
      const valueObj = expr.value as unknown as Record<string, string | undefined>
      const allExprs = Object.values(valueObj).filter((v): v is string => v !== undefined)
      result[key] = allExprs.join(' and ')
    }
  }

  return result
}

/**
 * Evaluates defs keys in dependency order.
 *
 * Defs keys are evaluated in topological order so that if key A
 * depends on key B, B is evaluated first and available in the context.
 *
 * @param defs - Defs section from the form (key → Expression)
 * @param baseContext - Context with field values (defs keys will be added)
 * @returns Map of defs key → evaluated value
 */
function evaluateDefsKeys(
  defs: DefsSection | undefined,
  baseContext: EvaluationContext
): Map<string, unknown> {
  const defsValues = new Map<string, unknown>()

  if (!defs || Object.keys(defs).length === 0) {
    return defsValues
  }

  // Extract expression strings for dependency sorting
  const expressionsForSorting = extractExpressionsForSorting(defs)

  // Sort defs keys in dependency order
  const { sorted: sortedKeys } = topologicalSortDefsKeys(expressionsForSorting)

  // Build up context incrementally as we evaluate
  const context: EvaluationContext = { ...baseContext }

  for (const key of sortedKeys) {
    const expr = defs[key]
    if (expr) {
      // Evaluate the expression with current context (includes previously evaluated keys)
      const value = evaluateDefsExpression(expr, context)
      defsValues.set(key, value)
      // Add to context for subsequent evaluations
      ;(context as Record<string, unknown>)[key] = value
    }
  }

  return defsValues
}

/**
 * Builds an evaluation context from a Form and data payload.
 *
 * The context has the structure:
 * ```typescript
 * {
 *   fields: {
 *     age: 25,
 *     name: 'John',
 *     rent: { amount: 1000, currency: 'USD' },  // object field
 *     address: {  // fieldset
 *       street: '123 Main',
 *       city: 'NYC'
 *     }
 *   },
 *   parties: {
 *     buyer: [{ type: 'person', data: {...}, signed: false }],
 *     seller: [{ type: 'organization', data: {...}, signed: true }],
 *   },
 *   witnesses: [{ type: 'person', data: {...}, signed: true }],
 *   isAdult: true,        // evaluated defs key
 *   hasLicense: false,    // evaluated defs key
 * }
 * ```
 *
 * @param form - The Form artifact
 * @param data - The data payload with field values, parties, and witnesses
 * @returns EvaluationContext ready for expression evaluation
 *
 * @example
 * ```typescript
 * const form = {
 *   kind: 'form',
 *   name: 'test',
 *   version: '1.0',
 *   title: 'Test',
 *   fields: {
 *     age: { type: 'number' },
 *     name: { type: 'text' }
 *   },
 *   parties: [{ id: 'buyer', label: 'Buyer' }],
 *   defs: {
 *     isAdult: {
 *       type: 'boolean',
 *       value: 'fields.age >= 18'
 *     },
 *     hasBuyer: {
 *       type: 'boolean',
 *       value: 'partyCount("buyer") > 0'
 *     }
 *   }
 * }
 *
 * const data = {
 *   fields: { age: 25, name: 'John' },
 *   parties: { buyer: { type: 'person', name: 'John' } }
 * }
 * const context = buildFormContext(form, data)
 *
 * // context.fields.age === 25
 * // context.parties.buyer[0].type === 'person'
 * // context.isAdult === true
 * ```
 */
export function buildFormContext(form: Form, data: FormDataPayload): EvaluationContext {
  // Build fields context structure
  const fields = buildFieldsContext(form.fields, data.fields)

  // Build parties and witnesses context (with signatures)
  const parties = buildPartiesContext(data.parties, data.signatures)
  const witnesses = buildWitnessesContext(data.witnesses, undefined)

  // Create base context with fields, parties, and witnesses
  const baseContext: EvaluationContext = { fields, parties, witnesses }

  // Evaluate defs keys and add to context
  const defsValues = evaluateDefsKeys(form.defs, baseContext)

  // Merge defs keys into context
  const context: EvaluationContext = { fields, parties, witnesses }
  for (const [key, value] of defsValues) {
    ;(context as Record<string, unknown>)[key] = value
  }

  return context
}
