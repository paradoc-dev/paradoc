/**
 * Validate a form data payload the way the SDK does: `form.fill(data).validate()`.
 *
 * `paradoc data validate` and `paradoc data fill` both use this, so the CLI
 * accepts and rejects exactly what the SDK accepts and rejects.
 */

import {
  form as formApi,
  FormValidationError,
  type Form,
  type FormValidationResult,
  type ValidationError,
} from '@paradoc/core'

type RuleValidationResult = FormValidationResult['rules']['errors'][number]

/** The payload the SDK holds after a successful fill. */
export interface FilledPayload {
  fields: Record<string, unknown>
  parties?: Record<string, unknown>
  annexes?: Record<string, unknown>
}

export type PayloadValidationResult =
  | { success: true; data: FilledPayload }
  | { success: false; errors: ValidationError[]; ruleErrors: RuleValidationResult[] }

/** Fill the form with the payload and validate it, as the SDK does. */
export function validateFormPayload(formDef: Form, payload: Record<string, unknown>): PayloadValidationResult {
  const filled = formApi.from(formDef).safeFill(payload as never)
  if (!filled.success) {
    if (filled.error instanceof FormValidationError) {
      return { success: false, errors: filled.error.errors, ruleErrors: [] }
    }
    return { success: false, errors: [{ field: 'root', message: filled.error.message }], ruleErrors: [] }
  }

  const draft = filled.data
  const result = draft.validate()
  if (!result.valid) {
    return { success: false, errors: result.errors, ruleErrors: result.rules.errors }
  }

  return {
    success: true,
    data: {
      fields: draft.fields,
      ...(Object.keys(draft.parties).length > 0 && { parties: draft.parties }),
      ...(Object.keys(draft.annexes).length > 0 && { annexes: draft.annexes }),
    },
  }
}

/** Print validation errors and failed rules, one per line. */
export function printPayloadErrors(errors: ValidationError[], ruleErrors: RuleValidationResult[]): void {
  for (const error of errors) {
    console.error(`  - ${error.field || 'root'}: ${error.message}`)
  }
  for (const rule of ruleErrors) {
    console.error(`  - rules.${rule.ruleId}: ${rule.message ?? 'Rule failed'}`)
  }
}
