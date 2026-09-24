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
  Expression,
  DefsSection,
  WitnessParty,
} from '@paradoc/types'
import { inferPartyType } from '@/primitives/party'
import type { SigningState } from './signing-state'
import { EVALUATION_CLOCK, FUNCTION_REGISTRY, HOST_FUNCTIONS, PARTY_ENTRIES, ROW_VISIBILITY, WITNESS_ENTRIES, type ContextRowVisibility, type EvaluationContext, type EvaluationIssue, type NestedFieldValues, type PartyContextEntry } from './types'
import type { RuntimeContext } from '@/artifacts/shared/runtime-context'
import { topologicalSortDefsKeys } from '../../design-time/type-checking/build-type-environment'
import { isRowVisible } from '../../shared/list-paths'
import { defsDependencyExpressions } from '../../shared/defs-dependencies'
import { isScalarExpressionType } from '../../shared/expression-types'
import { evaluateGate, evaluateExpressionValue, withRowReferences, fromExpressionValue, markEvaluationContextReusable, toExpressionContext, wrapExpressionValue } from './expression-evaluator'
import { Values, type Value } from '@paradoc/expr'
import type { EvaluationContext as ExprEvaluationContext, HostFunction, Registry } from '@paradoc/expr'

/**
 * Data payload structure (matches form data shape).
 */
export interface FormDataPayload {
  fields?: Record<string, unknown>
  annexes?: Record<string, unknown>
  parties?: Record<string, Party | Party[]>
  witnesses?: readonly WitnessParty[]
  /** Who has signed; absent before signing. */
  signing?: SigningState
	context?: RuntimeContext
	/** Deterministic host functions available to artifact expressions. */
	expressionFunctions?: Readonly<Record<string, HostFunction>>
	/** Signatures corresponding to configured expression functions. */
	expressionRegistry?: Registry
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

/** The id a filled form gives a party, when it has one. */
function partyId(party: Party): string | undefined {
  const id = (party as { id?: unknown }).id
  return typeof id === 'string' ? id : undefined
}

/**
 * Builds the signing state the party predicates read, by role. A party has
 * signed when its id is among the role's signed party ids.
 */
function buildPartiesContext(
  parties: Record<string, Party | Party[]> | undefined,
  signed: SigningState['parties'],
): Record<string, PartyContextEntry[]> {
  const result: Record<string, PartyContextEntry[]> = {}
  for (const [roleId, partyData] of Object.entries(parties ?? {})) {
    const signedIds = new Set(signed?.[roleId] ?? [])
    result[roleId] = (Array.isArray(partyData) ? partyData : [partyData]).map((party) => {
      const id = partyId(party)
      return { type: inferPartyType(party), data: party, signed: id !== undefined && signedIds.has(id) }
    })
  }
  return result
}

/** Builds the signing state the witness predicates read. */
function buildWitnessesContext(
  witnesses: readonly WitnessParty[] | undefined,
  signed: SigningState['witnesses'],
): PartyContextEntry[] {
  const signedIds = new Set(signed ?? [])
  return (witnesses ?? []).map((witness) => ({
    type: inferPartyType(witness.party),
    data: witness.party,
    signed: signedIds.has(witness.id),
  }))
}

/** A computed value that failed with every input it reads present. */
interface DefinitionFailure {
	readonly expression: string
	readonly error: string
}

type DefinitionOutcome =
	| { readonly value: Value }
	| { readonly failure: DefinitionFailure }

/**
 * Evaluates one expression of a computed value. An input with no value makes
 * the result missing (null), not a failure.
 */
function evaluateDefinitionPart(expression: string, context: EvaluationContext): DefinitionOutcome {
	const evaluated = evaluateExpressionValue(expression, context)
	if (evaluated.success) return { value: evaluated.value }
	if (evaluated.code === 'missing-input') return { value: Values.null }
	return { failure: { expression, error: evaluated.code ? `${evaluated.code}: ${evaluated.error}` : evaluated.error } }
}

/**
 * Evaluates a single defs expression.
 *
 * For scalar types, evaluates the single expression string. For object types,
 * evaluates each property expression, nested members included, and constructs
 * the result object; a property whose inputs are missing is null.
 */
function evaluateDefsExpression(expr: Expression, context: EvaluationContext): DefinitionOutcome {
	if (isScalarExpressionType(expr.type)) {
		return evaluateDefinitionPart(expr.value as string, context)
	}

	return evaluateDefinitionMembers(expr.value as unknown as Record<string, unknown>, context)
}

/**
 * Evaluates the members of an object definition value. A member that is itself
 * an object, such as a bbox corner, becomes a nested object value.
 */
function evaluateDefinitionMembers(members: Record<string, unknown>, context: EvaluationContext): DefinitionOutcome {
	const result: Array<[string, Value]> = []
	for (const [propKey, member] of Object.entries(members)) {
		if (member === undefined) continue
		const outcome = typeof member === 'string'
			? evaluateDefinitionPart(member, context)
			: evaluateDefinitionMembers(member as Record<string, unknown>, context)
		if ('failure' in outcome) return outcome
		result.push([propKey, outcome.value])
	}
	return { value: Values.object(result) }
}

/**
 * Evaluates defs keys in dependency order.
 *
 * Defs keys are evaluated in topological order so that if key A depends on
 * key B, B is evaluated first and available in the context. A key that fails
 * is reported and reads as missing, so its dependents are missing too and
 * every other key still evaluates.
 *
 * @param defs - Defs section from the form (key → Expression)
 * @param baseContext - Context with field values (defs keys will be added)
 * @returns Each key's evaluated value, and the keys that failed
 */
function evaluateDefsKeys(
	defs: DefsSection | undefined,
	fields: Form['fields'],
	baseContext: EvaluationContext
): { values: Map<string, Value>; issues: EvaluationIssue[] } {
	const values = new Map<string, Value>()
	const issues: EvaluationIssue[] = []

	if (!defs || Object.keys(defs).length === 0) {
		return { values, issues }
	}

	// Extract expression strings for dependency sorting
	const expressionsForSorting = defsDependencyExpressions(defs, fields)

	// Sort defs keys in dependency order
	const { sorted: sortedKeys } = topologicalSortDefsKeys(expressionsForSorting)

	// Build up context incrementally as we evaluate
	const context: EvaluationContext = { ...baseContext }
	markEvaluationContextReusable(context)

	for (const key of sortedKeys) {
		const expr = defs[key]
		if (!expr) continue
		const outcome = evaluateDefsExpression(expr, context)
		let value: Value
		if ('failure' in outcome) {
			issues.push({
				message: `Failed to evaluate computed value "${key}": ${outcome.failure.error}`,
				path: ['defs', key],
				expression: outcome.failure.expression,
				originalError: outcome.failure.error,
			})
			value = Values.null
		} else {
			value = outcome.value
		}
		values.set(key, value)
		// Add to context for subsequent evaluations
		;(context as Record<string, unknown>)[key] = wrapExpressionValue(value)
	}

	return { values, issues }
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
 *     buyer: { id: 'buyer-0', name: 'John' },  // the parties as supplied
 *   },
 *   isAdult: true,        // evaluated defs key
 *   hasLicense: false,    // evaluated defs key
 * }
 * ```
 *
 * The signing state the party and witness predicates read, the clock, and the
 * host functions sit under symbols, so no defs key can replace them.
 *
 * @param form - The Form artifact
 * @param data - The data payload with field values, parties, witnesses, and signing state
 * @returns EvaluationContext ready for expression evaluation
 *
 * @example
 * ```typescript
 * const form = {
 *   kind: 'form',
 *   name: 'test',
 *   version: '1.0.0',
 *   title: 'Test',
 *   fields: {
 *     age: { type: 'number' },
 *     name: { type: 'text' }
 *   },
 *   parties: { buyer: { label: 'Buyer' } },
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
 *   parties: { buyer: { id: 'buyer-0', name: 'John' } }
 * }
 * const context = buildFormContext(form, data)
 *
 * // context.fields.age === 25
 * // context.parties.buyer.name === 'John'
 * // context.isAdult === true
 * // context.hasBuyer === true
 * ```
 */
/**
 * Row visibility for a form: a row is hidden when its list, a field above the
 * list, or its item's `visible` condition is false. Conditions read as the form
 * evaluator reads them: one whose inputs are missing hides the row, and one
 * that fails with its inputs present keeps it. A row
 * whose visibility is being decided cannot take part in deciding it, so a
 * condition that aggregates its own rows fails rather than recursing.
 */
function formRowVisibility(form: Form): ContextRowVisibility {
  const deciding = new Set<string>()
  return (listPath, indices, context) => {
    const key = `${listPath}@${indices.join(',')}`
    if (deciding.has(key)) throw new Error(`The visibility of ${listPath} rows depends on those rows`)
    deciding.add(key)
    try {
      return isRowVisible(form.fields, listPath, indices, context, (condition, rows) => {
        if (condition === undefined) return true
        const outcome = evaluateGate(
          condition,
          rows
            ? withRowReferences(context, {
                item: rows.item.value,
                itemOrigin: rows.item.origin,
                hasParent: rows.parent !== undefined,
                parent: rows.parent?.value,
                parentOrigin: rows.parent?.origin,
              })
            : context,
        )
        if (outcome.status === 'missing') return false
        return outcome.status === 'value' ? outcome.value : true
      })
    } finally {
      deciding.delete(key)
    }
  }
}

export function buildFormBaseContext(form: Form, data: FormDataPayload): EvaluationContext {
  // Build fields context structure
  const fields = buildFieldsContext(form.fields, data.fields)

  // Signing state for the party and witness predicates
  const parties = buildPartiesContext(data.parties, data.signing?.parties)
  const witnesses = buildWitnessesContext(data.witnesses, data.signing?.witnesses)

  // Create base context with fields, parties, and witnesses
	return {
		fields,
		parties: { ...(data.parties ?? {}) },
		[PARTY_ENTRIES]: parties,
		[WITNESS_ENTRIES]: witnesses,
		...(data.context?.asOf && { [EVALUATION_CLOCK]: data.context.asOf }),
		...(data.expressionFunctions && { [HOST_FUNCTIONS]: data.expressionFunctions }),
		...(data.expressionRegistry && { [FUNCTION_REGISTRY]: data.expressionRegistry }),
		[ROW_VISIBILITY]: formRowVisibility(form),
	}
}

export function buildFormContext(form: Form, data: FormDataPayload): EvaluationContext {
	return evaluateFormContext(form, data).context
}

/**
 * Builds the evaluation context and reports the computed values that failed.
 * A failed computed value reads as missing in the context, so everything else
 * still evaluates against it.
 */
export function evaluateFormContext(
	form: Form,
	data: FormDataPayload,
): { context: EvaluationContext; issues: EvaluationIssue[] } {
	const context = buildFormBaseContext(form, data)
	const { values, issues } = evaluateDefsKeys(form.defs, form.fields, context)

	// Merge public defs values into the same complete context used by downstream gates.
	for (const [key, value] of values) {
		;(context as Record<string, unknown>)[key] = fromExpressionValue(value)
	}

	return { context, issues }
}

/**
 * The expression context a form's templates read: the context its field logic
 * reads, with each party carrying the signing records its templates place
 * marks for.
 */
export function buildTemplateExpressionContext(
  form: Form,
  data: FormDataPayload,
  renderParties: Record<string, unknown>,
): ExprEvaluationContext {
  // A computed value that is missing or failed reads as missing here too.
  const context = buildFormContext(form, data)
  context.parties = renderParties
  return toExpressionContext(context)
}
