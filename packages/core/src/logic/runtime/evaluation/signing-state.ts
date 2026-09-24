/**
 * The signing state the signing predicates read, and how it follows from a
 * filled form's signing records.
 */

import type { Attestation, SignatureCapture } from '@paradoc/types'

/**
 * Who has signed, as the signing predicates (`signedCount`, `allSigned`,
 * `anySigned`, `allWitnessesSigned`, `anyWitnessSigned`) read it. The caller
 * that holds the signing records supplies it; with none, nobody has signed.
 */
export interface SigningState {
  /** By role, the ids of the parties whose signature is captured. */
  readonly parties?: Readonly<Record<string, readonly string[]>>
  /** The ids of the witnesses who have attested. */
  readonly witnesses?: readonly string[]
}

/**
 * The signing state of a form's signing records: a party has signed once its
 * signature is captured (initials and typed text do not count), and a witness
 * once it has attested.
 */
export function signingStateOf(
  captures: readonly SignatureCapture[],
  attestations: readonly Attestation[],
): SigningState {
  const parties: Record<string, string[]> = {}
  for (const capture of captures) {
    if (capture.type !== 'signature') continue
    const ids = (parties[capture.role] ??= [])
    if (!ids.includes(capture.partyId)) ids.push(capture.partyId)
  }
  const witnesses = new Set<string>()
  for (const attestation of attestations) {
    const id = attestation.witnessId ?? attestation.witness?.id
    if (id !== undefined) witnesses.add(id)
  }
  return { parties, witnesses: [...witnesses] }
}
