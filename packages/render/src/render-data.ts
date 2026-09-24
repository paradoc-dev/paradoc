import type { Form, FormData, RendererLayer, RenderRequest } from '@paradoc/types'

/**
 * The `FormData` keys `flattenRenderData` spreads at the root beside the field
 * values. Typed against `FormData`, so a new key must be placed here.
 */
const SPREAD_ROOTS: Record<Exclude<keyof FormData, 'fields' | 'signers' | 'captures'>, true> = {
  parties: true,
  signatories: true,
  annexes: true,
  defs: true,
}

/** Keys of flattened render data that are not field values. */
export const RENDER_DATA_ROOTS: ReadonlySet<string> = new Set([
  ...Object.keys(SPREAD_ROOTS),
  '_signers',
  '_captures',
])

/**
 * The flat record a template renders against, built from a render request's
 * `FormData`.
 *
 * Field values sit at the root, beside `parties`, `annexes` and `defs`, so a
 * template reads `annexes.photo` and `parties.landlord` by those names. Signers
 * and captures sit under the `_signers` and `_captures` roots the signing
 * directives read.
 */
export function flattenRenderData(data: FormData): Record<string, unknown> {
  const { fields, signers, captures, ...rest } = data
  return {
    ...fields,
    ...rest,
    ...(signers ? { _signers: signers } : {}),
    ...(captures ? { _captures: captures } : {}),
  }
}

/**
 * What a template renders against, read from a render request.
 *
 * A form's filled values sit at the root, beside the form that gives them
 * their field types. A checklist or document template has no field values:
 * it reads its artifact through the expression context alone.
 */
export function requestRenderData(request: RenderRequest<RendererLayer>): { data: Record<string, unknown>; form?: Form } {
  if (request.kind !== 'form') return { data: {} }
  const fields: unknown = (request.data as Partial<FormData> | undefined)?.fields
  if (fields === null || typeof fields !== 'object' || Array.isArray(fields)) {
    throw new TypeError('A form render request needs FormData: its data must hold a `fields` record.')
  }
  return { data: flattenRenderData(request.data), form: request.artifact }
}
