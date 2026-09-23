import type {
  RuntimeParty,
  SignatureCapture,
  SignatureCapturedContext,
  SignatureCapturedValue,
  SignaturePlaceholderContext,
  SignaturePlaceholderValue,
  Signer,
} from '@paradoc/types'
import { escapeHtml, type SigningDirective } from './template'

export interface TextSignatureOptions {
  format?: 'text' | 'html' | 'markdown'
  placeholder?: {
    signature?: SignaturePlaceholderValue
    initials?: SignaturePlaceholderValue
    signatureDate?: SignaturePlaceholderValue
    capacity?: SignaturePlaceholderValue
    printedName?: SignaturePlaceholderValue
  }
  captured?: {
    signature?: SignatureCapturedValue
    initials?: SignatureCapturedValue
    signatureDate?: SignatureCapturedValue
    capacity?: SignatureCapturedValue
    printedName?: SignatureCapturedValue
  }
  altText?: string
  cssClass?: string
}

interface ResolvedContext {
  role: string
  partyId: string
  signerId: string
  party?: RuntimeParty
  signer?: Signer
  capacity?: string
}

interface SignatureDefaults {
  signature: string
  initials: string
  date: string
  capacity: string
  printedName: string
  capturedSignature: string
  capturedInitials: string
}

const defaults: SignatureDefaults = {
  signature: '[SIGNATURE]',
  initials: '[INITIALS]',
  date: '[DATE]',
  capacity: '[CAPACITY]',
  printedName: '[PRINTED NAME]',
  capturedSignature: '[Signed]',
  capturedInitials: '[Initialed]',
}

function resolveValue<T extends SignaturePlaceholderContext | SignatureCapturedContext>(
  value: string | ((context: T) => string) | undefined,
  context: T,
  fallback: string,
): string {
  return value === undefined ? fallback : typeof value === 'function' ? value(context) : value
}

function resolveContext(value: unknown): ResolvedContext | undefined {
  if (!value || typeof value !== 'object') return undefined
  const context = value as Record<string, unknown>
  if (
    typeof context._role === 'string'
    && typeof context._partyId === 'string'
    && typeof context.signerId === 'string'
  ) {
    return {
      role: context._role,
      partyId: context._partyId,
      signerId: context.signerId,
      signer: context.signer as Signer | undefined,
      capacity: context.capacity as string | undefined,
    }
  }
  if (typeof context._role === 'string' && typeof context.id === 'string' && !context.signerId) {
    const signatory = Array.isArray(context.signatories)
      ? context.signatories[0] as Record<string, unknown> | undefined
      : undefined
    return {
      role: context._role,
      partyId: context.id,
      signerId: typeof signatory?.signerId === 'string' ? signatory.signerId : '',
      party: context as unknown as RuntimeParty,
      signer: signatory?.signer as Signer | undefined,
      capacity: signatory?.capacity as string | undefined,
    }
  }
  return undefined
}

function captureFor(
  root: Record<string, unknown>,
  context: ResolvedContext,
  locationId: string,
  type: 'signature' | 'initials' | 'capacity' | 'printed_name',
): SignatureCapture | undefined {
  if (!Array.isArray(root._captures)) return undefined
  return (root._captures as SignatureCapture[]).find((capture) =>
    capture.role === context.role
    && capture.partyId === context.partyId
    && capture.signerId === context.signerId
    && capture.locationId === locationId
    && capture.type === type
  )
}

function signerFor(root: Record<string, unknown>, context: ResolvedContext): Signer | undefined {
  if (context.signer) return context.signer
  return root._signers && typeof root._signers === 'object'
    ? (root._signers as Record<string, Signer>)[context.signerId]
    : undefined
}

function placeholderContext(
  root: Record<string, unknown>,
  context: ResolvedContext,
  locationId: string,
): SignaturePlaceholderContext {
  return {
    role: context.role,
    partyId: context.partyId,
    signerId: context.signerId,
    locationId,
    party: context.party,
    signer: signerFor(root, context),
    capacity: context.capacity,
  }
}

/** The `data-*` attributes that tie an HTML signing mark to its party, signer, and location. */
function markAttributes(context: { role: string; partyId: string; signerId: string }, locationId: string): string {
  return `data-role="${escapeHtml(context.role)}" data-party-id="${escapeHtml(context.partyId)}" data-signer-id="${escapeHtml(context.signerId)}" data-location-id="${escapeHtml(locationId)}"`
}

/** Escapes Markdown image alt text so it cannot close the `[...]` label. */
function markdownAlt(value: string): string {
  return value.replace(/[\\[\]]/g, (char) => `\\${char}`)
}

/** Percent-encodes the characters that would end or break a Markdown image destination. */
function markdownDestination(value: string): string {
  return value.replace(/[\s()<>\\]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`)
}

function invalid(name: string, args: unknown[]): string | undefined {
  return typeof args[0] === 'string' ? undefined : `[Invalid ${name}: expected a location]`
}

function contextError(name: string): string {
  return `[${name} error: no party. Use it inside a party or signatories loop, or pass the party first.]`
}

function renderMark(
  type: 'signature' | 'initials',
  capture: SignatureCapture | undefined,
  context: SignaturePlaceholderContext,
  options: TextSignatureOptions,
  signatureDefaults: SignatureDefaults,
): string {
  const captured = capture !== undefined
  const capturedOption = type === 'signature' ? options.captured?.signature : options.captured?.initials
  const placeholderOption = type === 'signature' ? options.placeholder?.signature : options.placeholder?.initials
  const capturedDefault = type === 'signature' ? signatureDefaults.capturedSignature : signatureDefaults.capturedInitials
  const placeholderDefault = type === 'signature' ? signatureDefaults.signature : signatureDefaults.initials
  const capturedContext = capture ? { ...context, capture } : undefined

  if (options.format === 'html') {
    const adopted = type === 'signature' ? context.signer?.adopted?.signature : context.signer?.adopted?.initials
    const image = capture?.image ?? adopted?.image
    const attributes = markAttributes(context, context.locationId)
    if (captured && image) {
      const alt = options.altText ?? (type === 'signature' ? 'Signature' : 'Initials')
      const cssClass = options.cssClass ?? `${type}-image`
      return `<img src="${escapeHtml(image)}" alt="${escapeHtml(alt)}" class="${escapeHtml(cssClass)}" ${attributes} />`
    }
    const text = capturedContext
      ? resolveValue(capturedOption, capturedContext, capturedDefault)
      : resolveValue(placeholderOption, context, placeholderDefault)
    return `<span class="${type}-${captured ? 'captured' : 'placeholder'}" ${attributes}>${text}</span>`
  }

  if (options.format === 'markdown') {
    const adopted = type === 'signature' ? context.signer?.adopted?.signature : context.signer?.adopted?.initials
    const image = capture?.image ?? adopted?.image
    if (captured && image) {
      const alt = options.altText ?? (type === 'signature' ? 'Signature' : 'Initials')
      return `![${markdownAlt(alt)}](${markdownDestination(image)})`
    }
    const text = capturedContext
      ? resolveValue(capturedOption, capturedContext, capturedDefault)
      : resolveValue(placeholderOption, context, placeholderDefault)
    return `_${text}_`
  }

  return capturedContext
    ? resolveValue(capturedOption, capturedContext, capturedDefault)
    : resolveValue(placeholderOption, context, placeholderDefault)
}

function createMarkDirective(type: 'signature' | 'initials', options: TextSignatureOptions, signatureDefaults: SignatureDefaults): SigningDirective {
  return (value, root, args) => {
    const problem = invalid(type, args)
    if (problem) return problem
    const context = resolveContext(value)
    if (!context) return contextError(type === 'signature' ? 'Signature' : 'Initials')
    const locationId = args[0] as string
    const capture = context.signerId ? captureFor(root, context, locationId, type) : undefined
    return renderMark(type, capture, placeholderContext(root, context, locationId), options, signatureDefaults)
  }
}

function createDateDirective(options: TextSignatureOptions, signatureDefaults: SignatureDefaults): SigningDirective {
  return (value, root, args) => {
    const problem = invalid('signatureDate', args)
    if (problem) return problem
    const context = resolveContext(value)
    if (!context) return contextError('SignatureDate')
    const locationId = args[0] as string
    const placeholder = placeholderContext(root, context, locationId)
    const capture = context.signerId ? captureFor(root, context, locationId, 'signature') : undefined
    if (!capture) {
      const text = resolveValue(options.placeholder?.signatureDate, placeholder, signatureDefaults.date)
      if (options.format !== 'html') return text
      return `<span class="signature-date-placeholder" ${markAttributes(context, locationId)}>${text}</span>`
    }
    const captured = { ...placeholder, capture }
    const date = capture.timestamp ? capture.timestamp.slice(0, 10) : signatureDefaults.date
    const text = resolveValue(options.captured?.signatureDate, captured, date)
    if (options.format !== 'html' || options.captured?.signatureDate !== undefined) return text
    return `<span class="signature-date" ${markAttributes(context, locationId)}>${text}</span>`
  }
}

function createCapacityDirective(options: TextSignatureOptions, signatureDefaults: SignatureDefaults): SigningDirective {
  return (value, root, args) => {
    const problem = invalid('capacity', args)
    if (problem) return problem
    const context = resolveContext(value)
    if (!context) return contextError('Capacity')
    const locationId = args[0] as string
    const placeholder = placeholderContext(root, context, locationId)
    const capture = context.signerId ? captureFor(root, context, locationId, 'capacity') : undefined
    if (capture) {
      const fallback = capture.text ?? context.capacity ?? signatureDefaults.capacity
      return resolveValue(options.captured?.capacity, { ...placeholder, capture }, fallback)
    }
    return context.capacity ?? resolveValue(options.placeholder?.capacity, placeholder, signatureDefaults.capacity)
  }
}

function createPrintedNameDirective(options: TextSignatureOptions, signatureDefaults: SignatureDefaults): SigningDirective {
  return (value, root, args) => {
    const problem = invalid('printedName', args)
    if (problem) return problem
    const context = resolveContext(value)
    if (!context) return contextError('PrintedName')
    const locationId = args[0] as string
    const placeholder = placeholderContext(root, context, locationId)
    const capture = context.signerId ? captureFor(root, context, locationId, 'printed_name') : undefined
    if (capture) {
      const fallback = capture.text ?? placeholder.signer?.person.name ?? signatureDefaults.printedName
      return resolveValue(options.captured?.printedName, { ...placeholder, capture }, fallback)
    }
    return placeholder.signer?.person.name
      ?? resolveValue(options.placeholder?.printedName, placeholder, signatureDefaults.printedName)
  }
}

export function createSignatureDirectives(
  options: TextSignatureOptions = {},
  signatureDefaults: SignatureDefaults = defaults,
): Record<string, SigningDirective> {
  return {
    signature: createMarkDirective('signature', options, signatureDefaults),
    initials: createMarkDirective('initials', options, signatureDefaults),
    signatureDate: createDateDirective(options, signatureDefaults),
    capacity: createCapacityDirective(options, signatureDefaults),
    printedName: createPrintedNameDirective(options, signatureDefaults),
  }
}

/** The signing directives a text, Markdown, or HTML template can write. */
export function createTextSignatureDirectives(options: TextSignatureOptions = {}): Record<string, SigningDirective> {
  return createSignatureDirectives(options)
}
