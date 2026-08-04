import type {
  RuntimeParty,
  SignatureCapture,
  SignatureCapturedContext,
  SignatureCapturedValue,
  SignaturePlaceholderContext,
  SignaturePlaceholderValue,
  Signer,
} from '@paradoc/types'
import type { TemplateHelper } from './template'

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

function invalid(name: string, args: unknown[]): string | undefined {
  return typeof args[0] === 'string' ? undefined : `[Invalid ${name} helper: expected (locationId)]`
}

function contextError(name: string): string {
  return `[${name} helper error: could not determine context. Use inside party or signatories loop.]`
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
    const attributes = `data-role="${context.role}" data-party-id="${context.partyId}" data-signer-id="${context.signerId}" data-location-id="${context.locationId}"`
    if (captured && image) {
      const alt = options.altText ?? (type === 'signature' ? 'Signature' : 'Initials')
      const cssClass = options.cssClass ?? `${type}-image`
      return `<img src="${image}" alt="${alt}" class="${cssClass}" ${attributes} />`
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
      return `![${alt}](${image})`
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

function createMarkHelper(type: 'signature' | 'initials', options: TextSignatureOptions, signatureDefaults: SignatureDefaults): TemplateHelper {
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

function createDateHelper(options: TextSignatureOptions, signatureDefaults: SignatureDefaults): TemplateHelper {
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
      return `<span class="signature-date-placeholder" data-role="${context.role}" data-party-id="${context.partyId}" data-signer-id="${context.signerId}" data-location-id="${locationId}">${text}</span>`
    }
    const captured = { ...placeholder, capture }
    const date = capture.timestamp ? capture.timestamp.slice(0, 10) : signatureDefaults.date
    const text = resolveValue(options.captured?.signatureDate, captured, date)
    if (options.format !== 'html' || options.captured?.signatureDate !== undefined) return text
    return `<span class="signature-date" data-role="${context.role}" data-party-id="${context.partyId}" data-signer-id="${context.signerId}" data-location-id="${locationId}">${text}</span>`
  }
}

function createCapacityTemplateHelper(options: TextSignatureOptions, signatureDefaults: SignatureDefaults): TemplateHelper {
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

function createPrintedNameTemplateHelper(options: TextSignatureOptions, signatureDefaults: SignatureDefaults): TemplateHelper {
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

export function createSignatureHelpers(
  options: TextSignatureOptions = {},
  signatureDefaults: SignatureDefaults = defaults,
): Record<string, TemplateHelper> {
  return {
    signature: createMarkHelper('signature', options, signatureDefaults),
    initials: createMarkHelper('initials', options, signatureDefaults),
    signatureDate: createDateHelper(options, signatureDefaults),
    capacity: createCapacityTemplateHelper(options, signatureDefaults),
    printedName: createPrintedNameTemplateHelper(options, signatureDefaults),
  }
}

export function createTextSignatureHelpers(options: TextSignatureOptions = {}): Record<string, TemplateHelper> {
  return createSignatureHelpers(options)
}

type StandaloneHelper = (
  this: Record<string, unknown>,
  locationId: string,
  options?: { data?: { root?: Record<string, unknown> } },
) => unknown

function createStandaloneHelper(name: string, options: TextSignatureOptions): StandaloneHelper {
  const helper = createSignatureHelpers(options)[name]!
  return function (this: Record<string, unknown>, locationId, handlebarsOptions) {
    return helper(this, handlebarsOptions?.data?.root ?? this, [locationId])
  }
}

export const createSignatureHelper = (options: TextSignatureOptions = {}) => createStandaloneHelper('signature', options)
export const createInitialsHelper = (options: TextSignatureOptions = {}) => createStandaloneHelper('initials', options)
export const createSignatureDateHelper = (options: TextSignatureOptions = {}) => createStandaloneHelper('signatureDate', options)
export const createCapacityHelper = (options: TextSignatureOptions = {}) => createStandaloneHelper('capacity', options)
export const createPrintedNameHelper = (options: TextSignatureOptions = {}) => createStandaloneHelper('printedName', options)

interface HelperRegistry {
  registerHelper(name: string, helper: StandaloneHelper): void
}

export function registerSignatureHelpers(registry: HelperRegistry, options: TextSignatureOptions = {}): void {
  registry.registerHelper('signature', createSignatureHelper(options))
  registry.registerHelper('initials', createInitialsHelper(options))
  registry.registerHelper('signatureDate', createSignatureDateHelper(options))
  registry.registerHelper('capacity', createCapacityHelper(options))
  registry.registerHelper('printedName', createPrintedNameHelper(options))
}
