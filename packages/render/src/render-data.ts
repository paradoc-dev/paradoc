import type { FormData } from '@paradoc/types'

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
