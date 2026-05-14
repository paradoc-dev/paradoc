/**
 * Handlebars helpers for signature and initials template markers.
 *
 * Template syntax (1-argument pattern):
 * - {{signature "locationId"}} - Renders a signature placeholder or captured status
 * - {{initials "locationId"}} - Renders an initials placeholder or captured status
 *
 * The helpers infer role, partyId, and signerId from the template context:
 * - Inside a party loop: uses party._role, party.id, and party.signatories[0]
 * - Inside a signatories loop: uses signatory.signerId and parent party context
 *
 * Context data required:
 * - parties: augmented with _role and signatories array
 * - _signers: Record<string, Signer> - global registry of signers
 * - _captures: SignatureCapture[] - capture events at specific locations
 *
 * Example template:
 * ```handlebars
 * {{#each parties.tenant}}
 * Name: {{name}}
 * Signature: {{signature "final-sig"}}
 * {{/each}}
 *
 * {{#each parties.landlord.signatories}}
 * {{signer.person.name}}, {{capacity}}
 * Signature: {{signature "final-sig"}}
 * {{/each}}
 * ```
 */

import type { HelperDelegate } from 'handlebars'
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
 * Options for signature rendering in text templates
 */
export interface TextSignatureOptions {
  /** Format for rendering (text, html, markdown). Defaults to 'text'. */
  format?: 'text' | 'html' | 'markdown'

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

  /** Alt text for signature images (html format only) */
  altText?: string
  /** CSS class for signature images (html format only) */
  cssClass?: string
}

const DEFAULT_PLACEHOLDER_SIGNATURE = '[SIGNATURE]'
const DEFAULT_PLACEHOLDER_INITIALS = '[INITIALS]'
const DEFAULT_PLACEHOLDER_DATE = '[DATE]'
const DEFAULT_PLACEHOLDER_CAPACITY = '[CAPACITY]'
const DEFAULT_PLACEHOLDER_PRINTED_NAME = '[PRINTED NAME]'
const DEFAULT_CAPTURED_SIGNATURE = '[Signed]'
const DEFAULT_CAPTURED_INITIALS = '[Initialed]'

/**
 * Augmented party type with _role and signatories
 */
type AugmentedParty = RuntimeParty & {
  _role: string
  signatories: Array<PartySignatory & { signer: Signer }>
}

/**
 * Augmented signatory type with signer data
 */
type AugmentedSignatory = PartySignatory & {
  signer: Signer
}

/**
 * Context extracted from template structure
 */
interface SignatureContext {
  role: string
  partyId: string
  signerId: string
  party?: RuntimeParty
  signer?: Signer
  capacity?: string
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
 * Augmented signatory type with back-references and signer data
 */
type AugmentedSignatoryWithRefs = AugmentedSignatory & {
  _role: string
  _partyId: string
}

/**
 * Extract signature context from Handlebars context.
 *
 * Handles two scenarios:
 * 1. Inside a party loop: `this` is a party with _role, id, signatories
 * 2. Inside a signatories loop: `this` is a signatory with _role, _partyId, signerId, signer
 */
function extractSignatureContext(thisContext: Record<string, unknown>): SignatureContext | null {
  // Case 1: Inside a signatories loop - signatory has _role, _partyId, signerId, signer
  if (
    typeof thisContext._role === 'string' &&
    typeof thisContext._partyId === 'string' &&
    typeof thisContext.signerId === 'string' &&
    thisContext.signer
  ) {
    const signatory = thisContext as unknown as AugmentedSignatoryWithRefs
    return {
      role: signatory._role,
      partyId: signatory._partyId,
      signerId: signatory.signerId,
      party: undefined, // Not available directly in signatories loop
      signer: signatory.signer,
      capacity: signatory.capacity,
    }
  }

  // Case 2: Inside a party loop - party has _role, id, signatories
  if (typeof thisContext._role === 'string' && typeof thisContext.id === 'string' && !thisContext.signerId) {
    const party = thisContext as unknown as AugmentedParty
    const signatories = party.signatories ?? []

    // Get the first signatory (or undefined if none)
    const signatory = signatories[0]
    if (!signatory) {
      // No signatory - return context without signerId
      return {
        role: party._role,
        partyId: party.id,
        signerId: '', // No signer
        party: party,
        signer: undefined,
        capacity: undefined,
      }
    }

    return {
      role: party._role,
      partyId: party.id,
      signerId: signatory.signerId,
      party: party,
      signer: signatory.signer,
      capacity: signatory.capacity,
    }
  }

  return null
}

/**
 * Render as text format
 */
function renderAsText(
  capture: SignatureCapture | undefined,
  ctx: SignaturePlaceholderContext,
  options: TextSignatureOptions,
  type: 'signature' | 'initials'
): string {
  const hasCaptured = capture !== undefined

  if (hasCaptured) {
    const capturedCtx: SignatureCapturedContext = {
      ...ctx,
      capture: capture!,
    }
    const capturedValue = type === 'signature' ? options.captured?.signature : options.captured?.initials
    const defaultCaptured = type === 'signature' ? DEFAULT_CAPTURED_SIGNATURE : DEFAULT_CAPTURED_INITIALS
    return resolveValue(capturedValue, capturedCtx, defaultCaptured)
  }

  const placeholderValue = type === 'signature' ? options.placeholder?.signature : options.placeholder?.initials
  const defaultPlaceholder = type === 'signature' ? DEFAULT_PLACEHOLDER_SIGNATURE : DEFAULT_PLACEHOLDER_INITIALS
  return resolveValue(placeholderValue, ctx, defaultPlaceholder)
}

/**
 * Render as HTML format
 */
function renderAsHtml(
  capture: SignatureCapture | undefined,
  ctx: SignaturePlaceholderContext,
  options: TextSignatureOptions,
  type: 'signature' | 'initials'
): string {
  const typeLabel = type === 'initials' ? 'initials' : 'signature'
  const adopted = type === 'signature' ? ctx.signer?.adopted?.signature : ctx.signer?.adopted?.initials
  const hasCaptured = capture !== undefined
  const image = capture?.image ?? adopted?.image

  if (hasCaptured && image) {
    // Render image
    const alt = options.altText ?? (type === 'initials' ? 'Initials' : 'Signature')
    const cssClass = options.cssClass ?? `${typeLabel}-image`
    return `<img src="${image}" alt="${alt}" class="${cssClass}" data-role="${ctx.role}" data-party-id="${ctx.partyId}" data-signer-id="${ctx.signerId}" data-location-id="${ctx.locationId}" />`
  }

  if (hasCaptured) {
    // Has capture but no image - render captured text
    const capturedCtx: SignatureCapturedContext = {
      ...ctx,
      capture: capture!,
    }
    const capturedValue = type === 'signature' ? options.captured?.signature : options.captured?.initials
    const defaultCaptured = type === 'signature' ? DEFAULT_CAPTURED_SIGNATURE : DEFAULT_CAPTURED_INITIALS
    const text = resolveValue(capturedValue, capturedCtx, defaultCaptured)
    return `<span class="${typeLabel}-captured" data-role="${ctx.role}" data-party-id="${ctx.partyId}" data-signer-id="${ctx.signerId}" data-location-id="${ctx.locationId}">${text}</span>`
  }

  // No capture - render placeholder
  const placeholderValue = type === 'signature' ? options.placeholder?.signature : options.placeholder?.initials
  const defaultPlaceholder = type === 'signature' ? DEFAULT_PLACEHOLDER_SIGNATURE : DEFAULT_PLACEHOLDER_INITIALS
  const text = resolveValue(placeholderValue, ctx, defaultPlaceholder)
  return `<span class="${typeLabel}-placeholder" data-role="${ctx.role}" data-party-id="${ctx.partyId}" data-signer-id="${ctx.signerId}" data-location-id="${ctx.locationId}">${text}</span>`
}

/**
 * Render as Markdown format
 */
function renderAsMarkdown(
  capture: SignatureCapture | undefined,
  ctx: SignaturePlaceholderContext,
  options: TextSignatureOptions,
  type: 'signature' | 'initials'
): string {
  const adopted = type === 'signature' ? ctx.signer?.adopted?.signature : ctx.signer?.adopted?.initials
  const hasCaptured = capture !== undefined
  const image = capture?.image ?? adopted?.image

  if (hasCaptured && image) {
    const alt = options.altText ?? (type === 'initials' ? 'Initials' : 'Signature')
    return `![${alt}](${image})`
  }

  if (hasCaptured) {
    // Has capture but no image - render captured text
    const capturedCtx: SignatureCapturedContext = {
      ...ctx,
      capture: capture!,
    }
    const capturedValue = type === 'signature' ? options.captured?.signature : options.captured?.initials
    const defaultCaptured = type === 'signature' ? DEFAULT_CAPTURED_SIGNATURE : DEFAULT_CAPTURED_INITIALS
    const text = resolveValue(capturedValue, capturedCtx, defaultCaptured)
    return `_${text}_`
  }

  // No capture - render placeholder
  const placeholderValue = type === 'signature' ? options.placeholder?.signature : options.placeholder?.initials
  const defaultPlaceholder = type === 'signature' ? DEFAULT_PLACEHOLDER_SIGNATURE : DEFAULT_PLACEHOLDER_INITIALS
  const text = resolveValue(placeholderValue, ctx, defaultPlaceholder)
  return `_${text}_`
}

/**
 * Create the signature helper function (1-argument pattern)
 *
 * Template usage: {{signature "locationId"}}
 *
 * The helper infers role, partyId, and signerId from the template context:
 * - Inside a party loop: party has _role, id, and signatories array
 * - Inside a signatories loop: signatory has signerId and signer
 *
 * @example
 * ```handlebars
 * {{#each parties.tenant}}
 * Name: {{name}}
 * Signature: {{signature "final-sig"}}
 * {{/each}}
 *
 * {{#each parties.landlord.signatories}}
 * {{signer.person.name}}, {{capacity}}
 * Signature: {{signature "final-sig"}}
 * {{/each}}
 * ```
 */
export function createSignatureHelper(options: TextSignatureOptions = {}): HelperDelegate {
  return function (
    this: Record<string, unknown>,
    locationId: string,
    handlebarsOptions?: { data?: { root?: Record<string, unknown> } }
  ): string {
    if (typeof locationId !== 'string') {
      return '[Invalid signature helper: expected (locationId)]'
    }

    // Extract context from template structure
    const sigCtx = extractSignatureContext(this)
    if (!sigCtx) {
      return '[Signature helper error: could not determine context. Use inside party or signatories loop.]'
    }

    if (!sigCtx.signerId) {
      // No signatory assigned - render placeholder
      const ctx: SignaturePlaceholderContext = {
        role: sigCtx.role,
        partyId: sigCtx.partyId,
        signerId: '',
        locationId,
        party: sigCtx.party,
        signer: undefined,
        capacity: undefined,
      }
      switch (options.format) {
        case 'html':
          return renderAsHtml(undefined, ctx, options, 'signature')
        case 'markdown':
          return renderAsMarkdown(undefined, ctx, options, 'signature')
        default:
          return renderAsText(undefined, ctx, options, 'signature')
      }
    }

    // Access root context for _captures
    const rootContext = handlebarsOptions?.data?.root ?? this

    // Find capture at this location
    const capture = findCapture(
      rootContext._captures as SignatureCapture[] | undefined,
      sigCtx.role,
      sigCtx.partyId,
      sigCtx.signerId,
      locationId,
      'signature'
    )

    // Get signer (may already have it from context, or look up)
    const signer = sigCtx.signer ?? getSigner(rootContext._signers as Record<string, Signer> | undefined, sigCtx.signerId)

    // Build context
    const ctx: SignaturePlaceholderContext = {
      role: sigCtx.role,
      partyId: sigCtx.partyId,
      signerId: sigCtx.signerId,
      locationId,
      party: sigCtx.party,
      signer,
      capacity: sigCtx.capacity,
    }

    switch (options.format) {
      case 'html':
        return renderAsHtml(capture, ctx, options, 'signature')
      case 'markdown':
        return renderAsMarkdown(capture, ctx, options, 'signature')
      default:
        return renderAsText(capture, ctx, options, 'signature')
    }
  }
}

/**
 * Create the initials helper function (1-argument pattern)
 *
 * Template usage: {{initials "locationId"}}
 *
 * @example
 * ```handlebars
 * {{#each parties.tenant}}
 * Initials: {{initials "page-3-init"}}
 * {{/each}}
 * ```
 */
export function createInitialsHelper(options: TextSignatureOptions = {}): HelperDelegate {
  return function (
    this: Record<string, unknown>,
    locationId: string,
    handlebarsOptions?: { data?: { root?: Record<string, unknown> } }
  ): string {
    if (typeof locationId !== 'string') {
      return '[Invalid initials helper: expected (locationId)]'
    }

    // Extract context from template structure
    const sigCtx = extractSignatureContext(this)
    if (!sigCtx) {
      return '[Initials helper error: could not determine context. Use inside party or signatories loop.]'
    }

    if (!sigCtx.signerId) {
      // No signatory assigned - render placeholder
      const ctx: SignaturePlaceholderContext = {
        role: sigCtx.role,
        partyId: sigCtx.partyId,
        signerId: '',
        locationId,
        party: sigCtx.party,
        signer: undefined,
        capacity: undefined,
      }
      switch (options.format) {
        case 'html':
          return renderAsHtml(undefined, ctx, options, 'initials')
        case 'markdown':
          return renderAsMarkdown(undefined, ctx, options, 'initials')
        default:
          return renderAsText(undefined, ctx, options, 'initials')
      }
    }

    // Access root context for _captures
    const rootContext = handlebarsOptions?.data?.root ?? this

    // Find capture at this location
    const capture = findCapture(
      rootContext._captures as SignatureCapture[] | undefined,
      sigCtx.role,
      sigCtx.partyId,
      sigCtx.signerId,
      locationId,
      'initials'
    )

    // Get signer
    const signer = sigCtx.signer ?? getSigner(rootContext._signers as Record<string, Signer> | undefined, sigCtx.signerId)

    // Build context
    const ctx: SignaturePlaceholderContext = {
      role: sigCtx.role,
      partyId: sigCtx.partyId,
      signerId: sigCtx.signerId,
      locationId,
      party: sigCtx.party,
      signer,
      capacity: sigCtx.capacity,
    }

    switch (options.format) {
      case 'html':
        return renderAsHtml(capture, ctx, options, 'initials')
      case 'markdown':
        return renderAsMarkdown(capture, ctx, options, 'initials')
      default:
        return renderAsText(capture, ctx, options, 'initials')
    }
  }
}

/**
 * Create the signatureDate helper function (1-argument pattern)
 *
 * Template usage: {{signatureDate "locationId"}}
 *
 * Renders the date a signature was captured, or a placeholder if not yet signed.
 * Looks for a capture of type 'signature' at the locationId (date accompanies signature).
 *
 * @example
 * ```handlebars
 * {{#each parties.tenant}}
 * Signed: {{signatureDate "final-sig"}}
 * {{/each}}
 * ```
 */
export function createSignatureDateHelper(options: TextSignatureOptions = {}): HelperDelegate {
  return function (
    this: Record<string, unknown>,
    locationId: string,
    handlebarsOptions?: { data?: { root?: Record<string, unknown> } }
  ): string {
    if (typeof locationId !== 'string') {
      return '[Invalid signatureDate helper: expected (locationId)]'
    }

    const sigCtx = extractSignatureContext(this)
    if (!sigCtx) {
      return '[SignatureDate helper error: could not determine context. Use inside party or signatories loop.]'
    }

    if (!sigCtx.signerId) {
      // No signatory assigned - render placeholder
      const ctx: SignaturePlaceholderContext = {
        role: sigCtx.role,
        partyId: sigCtx.partyId,
        signerId: '',
        locationId,
        party: sigCtx.party,
        signer: undefined,
        capacity: undefined,
      }
      const placeholderValue = options.placeholder?.signatureDate
      return resolveValue(placeholderValue, ctx, DEFAULT_PLACEHOLDER_DATE)
    }

    const rootContext = handlebarsOptions?.data?.root ?? this

    // Find a signature capture at this location (date accompanies signature)
    const capture = findCapture(
      rootContext._captures as SignatureCapture[] | undefined,
      sigCtx.role,
      sigCtx.partyId,
      sigCtx.signerId,
      locationId,
      'signature'
    )

    const signer = sigCtx.signer ?? getSigner(rootContext._signers as Record<string, Signer> | undefined, sigCtx.signerId)

    const ctx: SignaturePlaceholderContext = {
      role: sigCtx.role,
      partyId: sigCtx.partyId,
      signerId: sigCtx.signerId,
      locationId,
      party: sigCtx.party,
      signer,
      capacity: sigCtx.capacity,
    }

    if (capture) {
      const capturedCtx: SignatureCapturedContext = {
        ...ctx,
        capture,
      }

      // Default: extract date portion from ISO timestamp
      const defaultDate = capture.timestamp ? capture.timestamp.slice(0, 10) : '[DATE]'

      const capturedValue = options.captured?.signatureDate
      if (capturedValue !== undefined) {
        return resolveValue(capturedValue, capturedCtx, defaultDate)
      }

      // Format based on output format
      switch (options.format) {
        case 'html':
          return `<span class="signature-date" data-role="${ctx.role}" data-party-id="${ctx.partyId}" data-signer-id="${ctx.signerId}" data-location-id="${ctx.locationId}">${defaultDate}</span>`
        case 'markdown':
          return defaultDate
        default:
          return defaultDate
      }
    }

    // No capture - render placeholder
    const placeholderValue = options.placeholder?.signatureDate
    switch (options.format) {
      case 'html':
        return `<span class="signature-date-placeholder" data-role="${ctx.role}" data-party-id="${ctx.partyId}" data-signer-id="${ctx.signerId}" data-location-id="${ctx.locationId}">${resolveValue(placeholderValue, ctx, DEFAULT_PLACEHOLDER_DATE)}</span>`
      case 'markdown':
        return resolveValue(placeholderValue, ctx, DEFAULT_PLACEHOLDER_DATE)
      default:
        return resolveValue(placeholderValue, ctx, DEFAULT_PLACEHOLDER_DATE)
    }
  }
}

/**
 * Create the capacity helper function (1-argument pattern)
 *
 * Template usage: {{capacity "locationId"}}
 *
 * Renders the signer's capacity (role/title) — e.g., "President", "Trustee", "Attorney-in-fact".
 * Resolution order:
 * 1. Capture of type 'capacity' at locationId (capture.text takes priority)
 * 2. PartySignatory.capacity from the runtime context
 * 3. Configured / default placeholder
 *
 * @example
 * ```handlebars
 * {{#each parties.taxpayer.signatories}}
 * Signature: {{signature "sig-1"}}
 * Title: {{capacity "sig-1"}}
 * {{/each}}
 * ```
 */
export function createCapacityHelper(options: TextSignatureOptions = {}): HelperDelegate {
  return function (
    this: Record<string, unknown>,
    locationId: string,
    handlebarsOptions?: { data?: { root?: Record<string, unknown> } }
  ): string {
    if (typeof locationId !== 'string') {
      return '[Invalid capacity helper: expected (locationId)]'
    }

    const sigCtx = extractSignatureContext(this)
    if (!sigCtx) {
      return '[Capacity helper error: could not determine context. Use inside party or signatories loop.]'
    }

    const rootContext = handlebarsOptions?.data?.root ?? this
    const signer = sigCtx.signer ?? getSigner(rootContext._signers as Record<string, Signer> | undefined, sigCtx.signerId)

    const ctx: SignaturePlaceholderContext = {
      role: sigCtx.role,
      partyId: sigCtx.partyId,
      signerId: sigCtx.signerId ?? '',
      locationId,
      party: sigCtx.party,
      signer,
      capacity: sigCtx.capacity,
    }

    // 1. Capture takes priority
    if (sigCtx.signerId) {
      const capture = findCapture(
        rootContext._captures as SignatureCapture[] | undefined,
        sigCtx.role,
        sigCtx.partyId,
        sigCtx.signerId,
        locationId,
        'capacity'
      )
      if (capture) {
        const capturedCtx: SignatureCapturedContext = { ...ctx, capture }
        const capturedValue = options.captured?.capacity
        const defaultCaptured = capture.text ?? sigCtx.capacity ?? DEFAULT_PLACEHOLDER_CAPACITY
        if (capturedValue !== undefined) {
          return resolveValue(capturedValue, capturedCtx, defaultCaptured)
        }
        if (capture.text) return capture.text
      }
    }

    // 2. Fall back to PartySignatory.capacity
    if (sigCtx.capacity) return sigCtx.capacity

    // 3. Placeholder
    const placeholderValue = options.placeholder?.capacity
    return resolveValue(placeholderValue, ctx, DEFAULT_PLACEHOLDER_CAPACITY)
  }
}

/**
 * Create the printedName helper function (1-argument pattern)
 *
 * Template usage: {{printedName "locationId"}}
 *
 * Renders the typed-out name accompanying a signature.
 * Resolution order:
 * 1. Capture of type 'printed_name' at locationId (capture.text takes priority)
 * 2. Signer.person.name from the runtime context
 * 3. Configured / default placeholder
 *
 * @example
 * ```handlebars
 * {{#each parties.taxpayer.signatories}}
 * Signature: {{signature "sig-1"}}
 * Print name: {{printedName "sig-1"}}
 * {{/each}}
 * ```
 */
export function createPrintedNameHelper(options: TextSignatureOptions = {}): HelperDelegate {
  return function (
    this: Record<string, unknown>,
    locationId: string,
    handlebarsOptions?: { data?: { root?: Record<string, unknown> } }
  ): string {
    if (typeof locationId !== 'string') {
      return '[Invalid printedName helper: expected (locationId)]'
    }

    const sigCtx = extractSignatureContext(this)
    if (!sigCtx) {
      return '[PrintedName helper error: could not determine context. Use inside party or signatories loop.]'
    }

    const rootContext = handlebarsOptions?.data?.root ?? this
    const signer = sigCtx.signer ?? getSigner(rootContext._signers as Record<string, Signer> | undefined, sigCtx.signerId)

    const ctx: SignaturePlaceholderContext = {
      role: sigCtx.role,
      partyId: sigCtx.partyId,
      signerId: sigCtx.signerId ?? '',
      locationId,
      party: sigCtx.party,
      signer,
      capacity: sigCtx.capacity,
    }

    // 1. Capture takes priority
    if (sigCtx.signerId) {
      const capture = findCapture(
        rootContext._captures as SignatureCapture[] | undefined,
        sigCtx.role,
        sigCtx.partyId,
        sigCtx.signerId,
        locationId,
        'printed_name'
      )
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
    const placeholderValue = options.placeholder?.printedName
    return resolveValue(placeholderValue, ctx, DEFAULT_PLACEHOLDER_PRINTED_NAME)
  }
}

/**
 * Register signature, initials, signatureDate, capacity, and printedName helpers with a Handlebars instance
 */
export function registerSignatureHelpers(
  handlebars: typeof Handlebars,
  options: TextSignatureOptions = {}
): void {
  handlebars.registerHelper('signature', createSignatureHelper(options))
  handlebars.registerHelper('initials', createInitialsHelper(options))
  handlebars.registerHelper('signatureDate', createSignatureDateHelper(options))
  handlebars.registerHelper('capacity', createCapacityHelper(options))
  handlebars.registerHelper('printedName', createPrintedNameHelper(options))
}
