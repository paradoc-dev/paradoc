/**
 * Signature and initials helpers for docx-templates.
 *
 * Template syntax (function call pattern with 2-arguments):
 * - {{signature($party, "locationId")}} - Renders a signature for a party
 * - {{signature($signatory, "locationId")}} - Renders a signature for a signatory
 * - {{initials($party, "locationId")}} - Renders initials for a party
 * - {{initials($signatory, "locationId")}} - Renders initials for a signatory
 *
 * The helpers detect whether the first argument is a party or signatory:
 * - Party: has `_role`, `id`, and `signatories` array (uses first signatory)
 * - Signatory: has `_role`, `_partyId`, `signerId`, and `signer`
 *
 * Root data structure (via closure):
 * - _signers: Record<string, Signer> - global registry of signers
 * - _captures: SignatureCapture[] - capture events at specific locations
 *
 * Example template:
 * ```
 * LANDLORD:
 * {{FOR sig IN parties.landlord.signatories}}
 * {{$sig.signer.person.name}}, {{$sig.capacity}}
 * Signature: {{signature($sig, "final-sig")}}
 * {{END-FOR sig}}
 *
 * TENANT(S):
 * {{FOR tenant IN parties.tenant}}
 * Name: {{$tenant.name}}
 * {{FOR sig IN $tenant.signatories}}
 * Signature: {{signature($sig, "final-sig")}}
 * {{END-FOR sig}}
 * {{END-FOR tenant}}
 * ```
 */

import type {
  Signer,
  SignatureCapture,
  RuntimeParty,
  PartySignatory,
  SignaturePlaceholderContext,
  SignatureCapturedContext,
  SignaturePlaceholderValue,
  SignatureCapturedValue,
} from '@paradoc/types'

/**
 * Options for signature rendering in DOCX
 */
export interface DocxSignatureOptions {
  /** Placeholder options (before capture) */
  placeholder?: {
    /** Placeholder for signature. String or function. */
    signature?: SignaturePlaceholderValue
    /** Placeholder for initials. String or function. */
    initials?: SignaturePlaceholderValue
    /** Placeholder for signature date. String or function. */
    signatureDate?: SignaturePlaceholderValue
    /** Placeholder for signer capacity (role/title). String or function. */
    capacity?: SignaturePlaceholderValue
    /** Placeholder for printed name. String or function. */
    printedName?: SignaturePlaceholderValue
  }

  /** Captured options (after capture) */
  captured?: {
    /** Text/rendering for captured signature. String or function. */
    signature?: SignatureCapturedValue
    /** Text/rendering for captured initials. String or function. */
    initials?: SignatureCapturedValue
    /** Text/rendering for captured signature date. String or function. */
    signatureDate?: SignatureCapturedValue
    /** Text/rendering for captured capacity. String or function. */
    capacity?: SignatureCapturedValue
    /** Text/rendering for captured printed name. String or function. */
    printedName?: SignatureCapturedValue
  }
}

const DEFAULT_PLACEHOLDER_SIGNATURE = '_____________________________'
const DEFAULT_PLACEHOLDER_INITIALS = '______'
const DEFAULT_PLACEHOLDER_DATE = '__________'
const DEFAULT_PLACEHOLDER_CAPACITY = '________________'
const DEFAULT_PLACEHOLDER_PRINTED_NAME = '_______________________'
const DEFAULT_CAPTURED_SIGNATURE = '[Signed]'
const DEFAULT_CAPTURED_INITIALS = '[Initialed]'

/**
 * Augmented party type with _role and signatories
 */
type AugmentedParty = RuntimeParty & {
  _role: string
  signatories: Array<PartySignatory & { signer: Signer; _role: string; _partyId: string }>
}

/**
 * Augmented signatory type with signer data and back-references
 */
type AugmentedSignatory = PartySignatory & {
  signer: Signer
  _role: string
  _partyId: string
}

/**
 * Union type for party or signatory passed to helper
 */
type PartyOrSignatory = AugmentedParty | AugmentedSignatory

/**
 * Type guard to check if the context is a signatory (has signerId)
 */
function isSignatory(ctx: PartyOrSignatory): ctx is AugmentedSignatory {
  return 'signerId' in ctx && typeof ctx.signerId === 'string'
}

/**
 * Resolve a placeholder or captured value (string or function)
 */
function resolveValue<T extends SignaturePlaceholderContext | SignatureCapturedContext>(
  value: string | ((ctx: T) => string) | undefined,
  ctx: T,
  defaultValue: string
): string {
  if (value === undefined) return defaultValue
  if (typeof value === 'function') return value(ctx)
  return value
}

/**
 * Find a capture at a specific location
 */
function findCapture(
  captures: SignatureCapture[] | undefined,
  role: string,
  partyId: string,
  signerId: string,
  locationId: string,
  type: 'signature' | 'initials' | 'capacity' | 'printed_name'
): SignatureCapture | undefined {
  if (!captures) return undefined
  return captures.find(
    (c) =>
      c.role === role &&
      c.partyId === partyId &&
      c.signerId === signerId &&
      c.locationId === locationId &&
      c.type === type
  )
}

/**
 * Get signer from the signers registry
 */
function getSigner(
  signers: Record<string, Signer> | undefined,
  signerId: string
): Signer | undefined {
  if (!signers) return undefined
  return signers[signerId]
}

/**
 * Root data interface containing signature data
 */
interface RootData {
  _signers?: Record<string, Signer>
  _captures?: SignatureCapture[]
  parties?: Record<string, AugmentedParty | AugmentedParty[]>
  [key: string]: unknown
}

/**
 * Create signature helper functions for docx-templates.
 *
 * Uses 2-argument pattern where the party or signatory is passed explicitly.
 * This works with docx-templates' loop variables ($tenant, $sig, etc.).
 *
 * Template usage:
 * ```
 * LANDLORD:
 * {{FOR sig IN parties.landlord.signatories}}
 * {{$sig.signer.person.name}}, {{$sig.capacity}}
 * Signature: {{signature($sig, "final-sig")}}
 * {{END-FOR sig}}
 *
 * TENANT(S):
 * {{FOR tenant IN parties.tenant}}
 * Name: {{$tenant.name}}
 * {{FOR sig IN $tenant.signatories}}
 * Signature: {{signature($sig, "final-sig")}}
 * {{END-FOR sig}}
 * {{END-FOR tenant}}
 * ```
 */
export function createDocxSignatureHelpers(
  rootData: RootData,
  options: DocxSignatureOptions = {}
): {
  signature: (partyOrSignatory: PartyOrSignatory, locationId: string) => string
  initials: (partyOrSignatory: PartyOrSignatory, locationId: string) => string
  signatureDate: (partyOrSignatory: PartyOrSignatory, locationId: string) => string
  capacity: (partyOrSignatory: PartyOrSignatory, locationId: string) => string
  printedName: (partyOrSignatory: PartyOrSignatory, locationId: string) => string
} {
  // Capture data via closure
  const signers = rootData._signers
  const captures = rootData._captures

  return {
    /**
     * Signature helper - renders signature placeholder or captured status
     *
     * @param partyOrSignatory - The party or signatory object from template loop
     * @param locationId - The location ID for this signature
     */
    signature(partyOrSignatory: PartyOrSignatory, locationId: string): string {
      if (!partyOrSignatory || typeof partyOrSignatory !== 'object') {
        return '[Invalid signature: expected (party/signatory, locationId)]'
      }
      if (typeof locationId !== 'string') {
        return '[Invalid signature: expected (party/signatory, locationId)]'
      }

      // Extract context based on whether this is a party or signatory
      let role: string
      let partyId: string
      let signerId: string | undefined
      let party: RuntimeParty | undefined
      let signer: Signer | undefined
      let capacity: string | undefined

      if (isSignatory(partyOrSignatory)) {
        // It's a signatory - has _role, _partyId, signerId, signer
        role = partyOrSignatory._role
        partyId = partyOrSignatory._partyId
        signerId = partyOrSignatory.signerId
        signer = partyOrSignatory.signer
        capacity = partyOrSignatory.capacity
        party = undefined // Not available directly from signatory
      } else {
        // It's a party - has _role, id, signatories array
        const augmentedParty = partyOrSignatory as AugmentedParty
        role = augmentedParty._role
        partyId = augmentedParty.id
        party = augmentedParty

        // Use first signatory for signature
        const firstSignatory = augmentedParty.signatories?.[0]
        if (firstSignatory) {
          signerId = firstSignatory.signerId
          signer = firstSignatory.signer
          capacity = firstSignatory.capacity
        }
      }

      if (!role || !partyId) {
        return '[Signature error: invalid party/signatory context]'
      }

      // Build context
      const ctx: SignaturePlaceholderContext = {
        role,
        partyId,
        signerId: signerId ?? '',
        locationId,
        party,
        signer,
        capacity,
      }

      if (!signerId) {
        // No signatory - render placeholder
        return resolveValue(options.placeholder?.signature, ctx, DEFAULT_PLACEHOLDER_SIGNATURE)
      }

      // Check for capture at this location
      const capture = findCapture(captures, role, partyId, signerId, locationId, 'signature')

      // Get signer from registry if not already have it
      if (!signer) {
        signer = getSigner(signers, signerId)
        ctx.signer = signer
      }

      // If we have a capture, render captured text
      if (capture) {
        const capturedCtx: SignatureCapturedContext = {
          ...ctx,
          capture,
        }
        return resolveValue(options.captured?.signature, capturedCtx, DEFAULT_CAPTURED_SIGNATURE)
      }

      // No signature - render placeholder
      return resolveValue(options.placeholder?.signature, ctx, DEFAULT_PLACEHOLDER_SIGNATURE)
    },

    /**
     * Initials helper - renders initials placeholder or captured status
     *
     * @param partyOrSignatory - The party or signatory object from template loop
     * @param locationId - The location ID for these initials
     */
    initials(partyOrSignatory: PartyOrSignatory, locationId: string): string {
      if (!partyOrSignatory || typeof partyOrSignatory !== 'object') {
        return '[Invalid initials: expected (party/signatory, locationId)]'
      }
      if (typeof locationId !== 'string') {
        return '[Invalid initials: expected (party/signatory, locationId)]'
      }

      // Extract context based on whether this is a party or signatory
      let role: string
      let partyId: string
      let signerId: string | undefined
      let party: RuntimeParty | undefined
      let signer: Signer | undefined
      let capacity: string | undefined

      if (isSignatory(partyOrSignatory)) {
        // It's a signatory
        role = partyOrSignatory._role
        partyId = partyOrSignatory._partyId
        signerId = partyOrSignatory.signerId
        signer = partyOrSignatory.signer
        capacity = partyOrSignatory.capacity
        party = undefined
      } else {
        // It's a party
        const augmentedParty = partyOrSignatory as AugmentedParty
        role = augmentedParty._role
        partyId = augmentedParty.id
        party = augmentedParty

        const firstSignatory = augmentedParty.signatories?.[0]
        if (firstSignatory) {
          signerId = firstSignatory.signerId
          signer = firstSignatory.signer
          capacity = firstSignatory.capacity
        }
      }

      if (!role || !partyId) {
        return '[Initials error: invalid party/signatory context]'
      }

      // Build context
      const ctx: SignaturePlaceholderContext = {
        role,
        partyId,
        signerId: signerId ?? '',
        locationId,
        party,
        signer,
        capacity,
      }

      if (!signerId) {
        // No signatory - render placeholder
        return resolveValue(options.placeholder?.initials, ctx, DEFAULT_PLACEHOLDER_INITIALS)
      }

      // Check for capture at this location
      const capture = findCapture(captures, role, partyId, signerId, locationId, 'initials')

      // Get signer from registry if not already have it
      if (!signer) {
        signer = getSigner(signers, signerId)
        ctx.signer = signer
      }

      // If we have a capture, render captured text
      if (capture) {
        const capturedCtx: SignatureCapturedContext = {
          ...ctx,
          capture,
        }
        return resolveValue(options.captured?.initials, capturedCtx, DEFAULT_CAPTURED_INITIALS)
      }

      // No initials - render placeholder
      return resolveValue(options.placeholder?.initials, ctx, DEFAULT_PLACEHOLDER_INITIALS)
    },

    /**
     * Signature date helper - renders the date a signature was captured, or a placeholder
     *
     * Looks for a capture of type 'signature' at the locationId (date accompanies signature).
     * Use the same locationId as the corresponding `signature` helper.
     *
     * @param partyOrSignatory - The party or signatory object from template loop
     * @param locationId - The location ID (same as the corresponding signature helper)
     */
    signatureDate(partyOrSignatory: PartyOrSignatory, locationId: string): string {
      if (!partyOrSignatory || typeof partyOrSignatory !== 'object') {
        return '[Invalid signatureDate: expected (party/signatory, locationId)]'
      }
      if (typeof locationId !== 'string') {
        return '[Invalid signatureDate: expected (party/signatory, locationId)]'
      }

      // Extract context based on whether this is a party or signatory
      let role: string
      let partyId: string
      let signerId: string | undefined
      let party: RuntimeParty | undefined
      let signer: Signer | undefined
      let capacity: string | undefined

      if (isSignatory(partyOrSignatory)) {
        role = partyOrSignatory._role
        partyId = partyOrSignatory._partyId
        signerId = partyOrSignatory.signerId
        signer = partyOrSignatory.signer
        capacity = partyOrSignatory.capacity
        party = undefined
      } else {
        const augmentedParty = partyOrSignatory as AugmentedParty
        role = augmentedParty._role
        partyId = augmentedParty.id
        party = augmentedParty

        const firstSignatory = augmentedParty.signatories?.[0]
        if (firstSignatory) {
          signerId = firstSignatory.signerId
          signer = firstSignatory.signer
          capacity = firstSignatory.capacity
        }
      }

      if (!role || !partyId) {
        return '[SignatureDate error: invalid party/signatory context]'
      }

      const ctx: SignaturePlaceholderContext = {
        role,
        partyId,
        signerId: signerId ?? '',
        locationId,
        party,
        signer,
        capacity,
      }

      if (!signerId) {
        return resolveValue(options.placeholder?.signatureDate, ctx, DEFAULT_PLACEHOLDER_DATE)
      }

      // Find a signature capture at this location (date accompanies signature)
      const capture = findCapture(captures, role, partyId, signerId, locationId, 'signature')

      if (!signer) {
        signer = getSigner(signers, signerId)
        ctx.signer = signer
      }

      if (capture) {
        const capturedCtx: SignatureCapturedContext = {
          ...ctx,
          capture,
        }
        // Default: extract date portion from ISO timestamp
        const defaultDate = capture.timestamp ? capture.timestamp.slice(0, 10) : DEFAULT_PLACEHOLDER_DATE
        return resolveValue(options.captured?.signatureDate, capturedCtx, defaultDate)
      }

      // No capture - render placeholder
      return resolveValue(options.placeholder?.signatureDate, ctx, DEFAULT_PLACEHOLDER_DATE)
    },

    /**
     * Capacity helper - renders the signer's capacity (role/title)
     *
     * Resolution order:
     * 1. Capture of type 'capacity' at locationId (capture.text takes priority)
     * 2. PartySignatory.capacity from the runtime context
     * 3. Configured / default placeholder
     *
     * @param partyOrSignatory - The party or signatory object from template loop
     * @param locationId - The location ID for this capacity block
     */
    capacity(partyOrSignatory: PartyOrSignatory, locationId: string): string {
      if (!partyOrSignatory || typeof partyOrSignatory !== 'object') {
        return '[Invalid capacity: expected (party/signatory, locationId)]'
      }
      if (typeof locationId !== 'string') {
        return '[Invalid capacity: expected (party/signatory, locationId)]'
      }

      let role: string
      let partyId: string
      let signerId: string | undefined
      let party: RuntimeParty | undefined
      let signer: Signer | undefined
      let capacity: string | undefined

      if (isSignatory(partyOrSignatory)) {
        role = partyOrSignatory._role
        partyId = partyOrSignatory._partyId
        signerId = partyOrSignatory.signerId
        signer = partyOrSignatory.signer
        capacity = partyOrSignatory.capacity
        party = undefined
      } else {
        const augmentedParty = partyOrSignatory as AugmentedParty
        role = augmentedParty._role
        partyId = augmentedParty.id
        party = augmentedParty
        const firstSignatory = augmentedParty.signatories?.[0]
        if (firstSignatory) {
          signerId = firstSignatory.signerId
          signer = firstSignatory.signer
          capacity = firstSignatory.capacity
        }
      }

      if (!role || !partyId) {
        return '[Capacity error: invalid party/signatory context]'
      }

      const ctx: SignaturePlaceholderContext = {
        role,
        partyId,
        signerId: signerId ?? '',
        locationId,
        party,
        signer,
        capacity,
      }

      // 1. Capture takes priority
      if (signerId) {
        const capture = findCapture(captures, role, partyId, signerId, locationId, 'capacity')
        if (capture) {
          if (!signer) {
            signer = getSigner(signers, signerId)
            ctx.signer = signer
          }
          const capturedCtx: SignatureCapturedContext = { ...ctx, capture }
          const capturedValue = options.captured?.capacity
          const defaultCaptured = capture.text ?? capacity ?? DEFAULT_PLACEHOLDER_CAPACITY
          if (capturedValue !== undefined) {
            return resolveValue(capturedValue, capturedCtx, defaultCaptured)
          }
          if (capture.text) return capture.text
        }
      }

      // 2. Fall back to PartySignatory.capacity
      if (capacity) return capacity

      // 3. Placeholder
      return resolveValue(options.placeholder?.capacity, ctx, DEFAULT_PLACEHOLDER_CAPACITY)
    },

    /**
     * Printed name helper - renders the typed-out name accompanying a signature
     *
     * Resolution order:
     * 1. Capture of type 'printed_name' at locationId (capture.text takes priority)
     * 2. Signer.person.name from the runtime context
     * 3. Configured / default placeholder
     *
     * @param partyOrSignatory - The party or signatory object from template loop
     * @param locationId - The location ID for this printed name block
     */
    printedName(partyOrSignatory: PartyOrSignatory, locationId: string): string {
      if (!partyOrSignatory || typeof partyOrSignatory !== 'object') {
        return '[Invalid printedName: expected (party/signatory, locationId)]'
      }
      if (typeof locationId !== 'string') {
        return '[Invalid printedName: expected (party/signatory, locationId)]'
      }

      let role: string
      let partyId: string
      let signerId: string | undefined
      let party: RuntimeParty | undefined
      let signer: Signer | undefined
      let capacity: string | undefined

      if (isSignatory(partyOrSignatory)) {
        role = partyOrSignatory._role
        partyId = partyOrSignatory._partyId
        signerId = partyOrSignatory.signerId
        signer = partyOrSignatory.signer
        capacity = partyOrSignatory.capacity
        party = undefined
      } else {
        const augmentedParty = partyOrSignatory as AugmentedParty
        role = augmentedParty._role
        partyId = augmentedParty.id
        party = augmentedParty
        const firstSignatory = augmentedParty.signatories?.[0]
        if (firstSignatory) {
          signerId = firstSignatory.signerId
          signer = firstSignatory.signer
          capacity = firstSignatory.capacity
        }
      }

      if (!role || !partyId) {
        return '[PrintedName error: invalid party/signatory context]'
      }

      const ctx: SignaturePlaceholderContext = {
        role,
        partyId,
        signerId: signerId ?? '',
        locationId,
        party,
        signer,
        capacity,
      }

      if (!signer && signerId) {
        signer = getSigner(signers, signerId)
        ctx.signer = signer
      }

      // 1. Capture takes priority
      if (signerId) {
        const capture = findCapture(captures, role, partyId, signerId, locationId, 'printed_name')
        if (capture) {
          const capturedCtx: SignatureCapturedContext = { ...ctx, capture }
          const capturedValue = options.captured?.printedName
          const defaultCaptured = capture.text ?? signer?.person.name ?? DEFAULT_PLACEHOLDER_PRINTED_NAME
          if (capturedValue !== undefined) {
            return resolveValue(capturedValue, capturedCtx, defaultCaptured)
          }
          if (capture.text) return capture.text
        }
      }

      // 2. Fall back to Signer.person.name
      if (signer?.person.name) return signer.person.name

      // 3. Placeholder
      return resolveValue(options.placeholder?.printedName, ctx, DEFAULT_PLACEHOLDER_PRINTED_NAME)
    },
  }
}
