/**
 * Sealing a bundle as one packet.
 *
 * A form's seal targets one layer of one artifact. A bundle is several
 * artifacts a reader receives as one thing, and a signer signs the thing, not
 * its third part. So the packet needs its own seal, and it is not the per-part
 * seals collected in a list:
 *
 * - **One signature map.** Every slot of every part resolves into one map whose
 *   `page` is a page of the packet, so a ceremony places a field without
 *   knowing which artifact declared it.
 * - **One signer registry.** A part binds its own signer ids and knows nothing
 *   of the parts beside it, so two parts may each call a signer `signer-1`
 *   without meaning the same person. The packet therefore scopes every part
 *   signer as `<part>/<signerId>` and treats an unmapped collision as two
 *   people. Two part signers are the same person only when the caller says so,
 *   through `BundleSealOptions.signers`.
 * - **One document.** Each part reaches PDF, is flattened so its filled values
 *   are page content rather than form state, and the parts are merged in bundle
 *   order. Page numbers are the merge's own: a part's locator answers in that
 *   part's page space, and the offset from the parts before it carries the
 *   answer into the packet's.
 * - **Two hashes, and only one of them is signed.** `canonicalPdfHash` is the
 *   hash of the merged PDF and is what a signing ceremony binds to: it is the
 *   document a signer sees and signs. `packetHash` is the packet's record, over
 *   the merged document and everything travelling beside it, so a part nobody
 *   could paint is still accounted for. A ceremony that bound to `packetHash`
 *   would be binding a signer to bytes they were never shown.
 *
 * Each part is still sealed by the part's own machinery. `prepareSeal` renders
 * its layer twice, locates its markers, and checks its own drift, because those
 * are questions about one document's layout and only that document's renderer
 * can answer them. This module asks each part once, in order, and composes the
 * answers.
 */

import { flattenPdf, inspectPdf, mergePdfs } from '@paradoc/render/pdf'
import type {
  BinaryContent,
  Bundle,
  BundleContentItem,
  Checklist,
  Document,
  Form,
  Resolver,
  SealAdapter,
  SealLocator,
  SigningField,
} from '@paradoc/types'
import type { DraftForm } from '@/artifacts/form'
import { SealConfigError, hasSignatureSlots, compileLegacySignatureSlots } from '@/artifacts/form/seal-slots'
import type { DraftChecklist } from '@/artifacts/checklist'
import type { DraftDocument } from '@/artifacts/document'
import {
  assembleBundle,
  isAssemblyBytesEntry,
  type ArtifactResolver,
  type AssemblyContentEntry,
} from './bundle-assembler'
import type { RendererRegistry } from './renderer-registry'

/** What a part turned out to be once the packet was assembled. */
export type PacketPartKind =
  /** An artifact whose layer declares signature slots. Sealed, and its slots are in the map. */
  | 'sealed'
  /** An artifact with no slots on its target layer. Rendered and carried. */
  | 'rendered'
  /** Content that arrived as bytes. */
  | 'annex'

/** One part of the packet, and where it landed in it. */
export interface PacketPart {
  /** The bundle content key. */
  key: string
  /** What the part is. */
  kind: PacketPartKind
  /** What the part's content turned out to be. */
  mimeType: string
  /** Name the part is carried under. */
  filename: string
  /** `sha256:` digest of the part's own bytes, as they entered the packet. */
  digest: string
  /** Pages the part contributes, and where they start in the packet. Zero pages for an attachment. */
  pageCount: number
  /** 1-based packet page the part's first page is. Zero when it contributes none. */
  firstPage: number
  /** True when the part could not be merged into the packet and travels beside it. */
  attached: boolean
  /** The part's own bytes. */
  content: BinaryContent
}

/**
 * One signer of the packet.
 *
 * The packet's signers are not the parts' signers. A part binds ids in its own
 * namespace, so the packet scopes each one and only merges two when the caller
 * maps them to the same packet id.
 */
export interface PacketSigner {
  /** Packet-level signer id: `<part>/<signerId>` unless the caller mapped it. */
  id: string
  /** 0-based index into the packet's signing order. `signerIndex` on the map is this. */
  index: number
  /** The part signers this one is, as `<part>/<signerId>`, in the order they appear. */
  parts: string[]
}

/**
 * One resolved signature slot, in the packet's page space.
 *
 * `id` is unique across the packet, because two artifacts may each declare a
 * slot called `signature`. `part` and `slot` say what it was before the packet
 * renamed it, and `partSignerId` the id the part itself bound, before the
 * packet scoped it.
 */
export interface PacketSigningField extends SigningField {
  /** Bundle content key of the part the slot sits in. */
  part: string
  /** The slot's id inside that part's layer. */
  slot: string
  /** 1-based page within the part, before the packet offset. */
  partPage: number
  /** The signer id the part bound, unscoped. */
  partSignerId: string
}

/** What `sealBundle` produces. */
export interface SealedBundle {
  /** The bundle that was sealed. */
  bundle: Bundle
  /** The packet: every paintable part's pages, flattened and merged in bundle order. */
  pdf: Uint8Array
  /**
   * `sha256:` digest of `pdf`, and the hash a signing ceremony binds to. It is
   * the document a signer is shown, so it is the document they sign.
   */
  canonicalPdfHash: string
  /**
   * `sha256:` digest of the packet's record: the merged document's hash and
   * every part beside it, in bundle order, each named with what it is and what
   * it hashes to. It accounts for parts that are not in `pdf`, and it is not
   * what a signer signs.
   */
  packetHash: string
  /** Every signer of the packet, in signing order. */
  signers: PacketSigner[]
  /** Every slot of every part, in signing order, on packet pages. */
  signatureMap: PacketSigningField[]
  /** The parts, in bundle order. */
  parts: PacketPart[]
  /** Everything the seal reported without failing, including every part carried rather than merged. */
  warnings: string[]
}

/** What `sealBundle` needs. */
export interface BundleSealOptions {
  /** Resolver for file-backed layers. */
  resolver?: Resolver | ArtifactResolver
  /** Renderers keyed by layer MIME type, reaching every part's render and every part's seal. */
  renderers?: RendererRegistry
  /** Converter for a part whose layer is neither PDF nor drawn by a registered renderer. */
  adapter?: SealAdapter
  /** Locator for anchor placements, when a part declares one. */
  locate?: SealLocator
  /** One entry per bundle content key. */
  contents: Record<string, AssemblyContentEntry>
  /**
   * Which part signers are the same person, as `<part>/<signerId>` to a packet
   * signer id.
   *
   * Without an entry a part signer is its own packet signer, because a part
   * binds ids in its own namespace and two parts calling a signer `signer-1`
   * is not evidence that one person signs both. Naming a part signer that does
   * not exist is an error, so a typo does not silently leave two signers where
   * one was meant.
   *
   * @example
   * ```typescript
   * signers: {
   *   'purchase-order/buyer-signer': 'acme-buyer',
   *   'w-9/taxpayer-signer': 'acme-buyer',
   * }
   * ```
   */
  signers?: Record<string, string>
}

/** Thrown when a bundle cannot become a packet. */
export class BundleSealError extends Error {
  /** Everything wrong, one sentence each. */
  readonly problems: string[]
  /** The bundle content key the failure belongs to, when it belongs to one. */
  readonly part: string | undefined

  constructor(message: string, problems: string[], part?: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'BundleSealError'
    this.problems = problems
    this.part = part
  }
}

const encoder = new TextEncoder()

/** `sha256:<hex>` over the bytes. */
async function digestOf(bytes: BinaryContent): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer)
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

/** A draft entry, which is anything that is not bytes. */
type DraftEntry = DraftForm<Form> | DraftChecklist<Checklist> | DraftDocument<Document>

/** The artifact a draft entry carries, whatever kind it is. */
function entryArtifact(entry: DraftEntry): { name?: string; version?: string } | undefined {
  if ('form' in entry) return (entry as DraftForm<Form>).form
  if ('checklist' in entry) return (entry as DraftChecklist<Checklist>).checklist
  if ('document' in entry) return (entry as DraftDocument<Document>).document
  return undefined
}

/**
 * The layer a draft entry seals through, when it has slots to seal.
 *
 * Only a form carries a seal: a checklist and a document have no parties. A
 * form whose target layer declares no slots, in either the unified or the
 * legacy shape, is rendered and carried like any other part.
 */
function sealableForm(entry: DraftEntry): DraftForm<Form> | undefined {
  if (!('form' in entry)) return undefined
  const draft = entry as DraftForm<Form>
  const layer = draft.form.layers?.[draft.targetLayer]
  if (!layer) return undefined
  return hasSignatureSlots(layer) || compileLegacySignatureSlots(layer) ? draft : undefined
}

/**
 * The artifact a bundle item names, when the item names one this can compare.
 *
 * A registry item names its artifact by slug. The convention the registry uses
 * is that the slug's last segment is the artifact's name, optionally followed
 * by `@version`, so `@paradoc/essentials/tax/w-9` names `w-9`. A path item
 * names a file rather than an identity, so there is nothing to compare.
 */
function declaredArtifact(item: BundleContentItem): { name?: string; version?: string } | undefined {
  if (item.type === 'inline') return item.artifact
  if (item.type !== 'registry') return undefined
  const last = item.slug.split('/').pop() ?? item.slug
  const at = last.lastIndexOf('@')
  return at > 0 ? { name: last.slice(0, at), version: last.slice(at + 1) } : { name: last }
}

/** The file signatures the packet can recognise, by the type they mean. */
const SIGNATURES: readonly { mimeType: string; matches: (bytes: Uint8Array) => boolean }[] = [
  { mimeType: 'application/pdf', matches: (b) => starts(b, [0x25, 0x50, 0x44, 0x46, 0x2d]) },
  { mimeType: 'image/png', matches: (b) => starts(b, [0x89, 0x50, 0x4e, 0x47]) },
  { mimeType: 'image/jpeg', matches: (b) => starts(b, [0xff, 0xd8, 0xff]) },
  { mimeType: 'image/gif', matches: (b) => starts(b, [0x47, 0x49, 0x46, 0x38]) },
  {
    mimeType: 'image/tiff',
    matches: (b) => starts(b, [0x49, 0x49, 0x2a, 0x00]) || starts(b, [0x4d, 0x4d, 0x00, 0x2a]),
  },
  { mimeType: 'application/zip', matches: (b) => starts(b, [0x50, 0x4b, 0x03, 0x04]) },
]

function starts(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte)
}

/** True for a format stored as a zip, which sniffs as one. */
function isZipContainer(mimeType: string): boolean {
  return (
    mimeType.startsWith('application/vnd.openxmlformats-officedocument.') ||
    mimeType.startsWith('application/vnd.oasis.opendocument.') ||
    mimeType === 'application/epub+zip'
  )
}

/**
 * Why the bytes are not what the entry says they are, or undefined when they
 * could be.
 *
 * A declared type this cannot recognise passes: a packet should not refuse a
 * format it has no signature for. A declared type it can recognise must match,
 * because an annex declared `application/pdf` that is a scan is the failure
 * this exists to catch, and it would otherwise surface as a parser error about
 * a byte offset.
 */
function sniffMismatch(bytes: Uint8Array, declared: string): string | undefined {
  const sniffed = SIGNATURES.find((signature) => signature.matches(bytes))?.mimeType
  if (sniffed !== undefined) {
    if (sniffed === declared) return undefined
    if (sniffed === 'application/zip' && isZipContainer(declared)) return undefined
    return `it is declared ${declared} but its bytes begin with a ${sniffed} signature`
  }
  const recognisable = SIGNATURES.some((signature) => signature.mimeType === declared)
  if (recognisable) return `it is declared ${declared} but its bytes carry no ${declared} signature`
  return undefined
}

/** Wraps a per-part failure so it names the part rather than a byte offset. */
function partFailure(key: string, action: string, error: unknown): BundleSealError {
  if (error instanceof BundleSealError) return error
  const detail = error instanceof Error ? error.message : String(error)
  const problem = `${action} part "${key}" failed: ${detail}`
  return new BundleSealError(`Cannot seal bundle: ${problem}`, [problem], key, error)
}

/**
 * Seal a bundle as one packet.
 *
 * Every content key the bundle declares must have an entry, because a packet
 * missing a part is a different packet. Order is the bundle's, not the entries'.
 *
 * @throws {BundleSealError} when a part is missing, when an entry is not what
 * the bundle declares, when a part fails to render or seal, or when nothing in
 * the packet can be painted. `part` names the part when the failure belongs to
 * one.
 * @throws {SealConfigError} when a rendered part's renderer returns something
 * that is not a PDF, which no packet can hold.
 * @throws {PdfMergeError} when a part reached a PDF the merge cannot read.
 */
export async function sealBundle(bundle: Bundle, options: BundleSealOptions): Promise<SealedBundle> {
  const { contents, renderers, resolver, adapter, locate } = options

  const problems: string[] = []
  const declared = bundle.contents.map((content) => content.key)
  const items = new Map(bundle.contents.map((content) => [content.key, content]))
  for (const key of declared) {
    if (!(key in contents)) problems.push(`bundle content "${key}" has no entry`)
  }
  for (const key of Object.keys(contents)) {
    if (!declared.includes(key)) {
      problems.push(`entry "${key}" is not a content of this bundle; it declares ${declared.join(', ')}`)
    }
  }
  if (problems.length > 0) {
    throw new BundleSealError(`Cannot seal bundle: ${problems.join('; ')}`, problems)
  }

  // An entry has to be the part the bundle declares. A packet assembled from
  // the wrong W-9 is a valid packet of the wrong documents, and nothing later
  // would notice.
  for (const key of declared) {
    const entry = contents[key]!
    const item = items.get(key)!
    if (isAssemblyBytesEntry(entry)) {
      const mismatch = sniffMismatch(entry.content, entry.mimeType)
      if (mismatch) problems.push(`content for "${key}" does not match its own declaration: ${mismatch}`)
      continue
    }
    const wanted = declaredArtifact(item)
    if (!wanted?.name) continue
    const supplied = entryArtifact(entry)
    if (supplied?.name !== wanted.name) {
      problems.push(
        `content for "${key}" is the artifact "${supplied?.name ?? 'unnamed'}" but the bundle declares "${wanted.name}"`,
      )
    } else if (wanted.version !== undefined && supplied.version !== wanted.version) {
      problems.push(
        `content for "${key}" is "${wanted.name}" version ${supplied.version ?? 'unstated'} but the bundle declares version ${wanted.version}`,
      )
    }
  }
  if (problems.length > 0) {
    throw new BundleSealError(
      `Cannot seal bundle: ${problems.length} content ${problems.length === 1 ? 'mismatch' : 'mismatches'}: ${problems.join('; ')}`,
      problems,
    )
  }

  // Each part reaches PDF on its own terms: a part with slots through its own
  // seal, everything else through ordinary assembly. Each is asked separately
  // so a failure names the part it belongs to.
  const sealedParts = new Map<string, { pdf: Uint8Array; map: SigningField[] }>()
  const warnings: string[] = []
  const renderedParts = new Map<string, { content: BinaryContent; mimeType: string; filename: string }>()

  for (const key of declared) {
    const entry = contents[key]!
    if (isAssemblyBytesEntry(entry)) {
      renderedParts.set(key, {
        content: entry.content,
        mimeType: entry.mimeType,
        filename: entry.filename ?? `${key}.pdf`,
      })
      continue
    }
    const form = sealableForm(entry)
    if (form) {
      try {
        const preparation = await form.prepareSeal({ resolver, renderers, adapter, locate })
        sealedParts.set(key, { pdf: preparation.pdf, map: preparation.signatureMap })
        warnings.push(...preparation.warnings.map((warning) => `${key}: ${warning}`))
      } catch (error) {
        throw partFailure(key, 'sealing', error)
      }
      continue
    }
    try {
      const assembled = await assembleBundle(bundle, { resolver, renderers, contents: { [key]: entry } })
      renderedParts.set(key, assembled.outputs[key]!)
    } catch (error) {
      throw partFailure(key, 'rendering', error)
    }
  }

  // The packet is assembled in bundle order, so a part's page offset is the
  // pages of every part before it.
  const parts: PacketPart[] = []
  const pdfParts: Uint8Array[] = []
  const located: { key: string; field: SigningField; firstPage: number }[] = []
  const unmergeable: string[] = []
  let packetPages = 0

  for (const key of declared) {
    const sealed = sealedParts.get(key)
    const output = renderedParts.get(key)
    const content = sealed ? sealed.pdf : output!.content
    const mimeType = sealed ? 'application/pdf' : output!.mimeType
    const filename = sealed ? `${key}.pdf` : output!.filename
    const kind: PacketPartKind = sealed
      ? 'sealed'
      : isAssemblyBytesEntry(contents[key]!)
        ? 'annex'
        : 'rendered'

    // A part this package rendered has to be a PDF. An annex may be anything,
    // because an annex is whatever somebody uploaded.
    if (kind !== 'annex' && mimeType !== 'application/pdf') {
      const problem =
        `part "${key}" rendered ${mimeType}, and a packet holds PDF pages. ` +
        'Register a renderer for that layer that produces a PDF, or pass a SealAdapter that converts it.'
      throw new SealConfigError(`Cannot seal bundle: ${problem}`, [problem])
    }

    // Flattening is what makes a filled form's values part of the page rather
    // than form state a merge would drop.
    let flat: Uint8Array | undefined
    let pageCount = 0
    let reason = `it is ${mimeType}, which the packet cannot paint`
    if (mimeType === 'application/pdf') {
      try {
        flat = await flattenPdf(content)
        pageCount = (await inspectPdf(flat)).pageCount
        if (pageCount === 0) throw new Error('it has no pages')
      } catch (error) {
        // A part this package produced failing to read is a fault. An annex is
        // whatever somebody uploaded, and one nobody can open is exactly the
        // case the specification says to carry as a named attachment.
        if (kind !== 'annex') throw partFailure(key, 'reading', error)
        flat = undefined
        reason = `its bytes could not be read as a PDF: ${error instanceof Error ? error.message : String(error)}`
      }
    }

    if (!flat) {
      unmergeable.push(`${key} (${mimeType})`)
      warnings.push(`${key}: carried as an attachment because ${reason}`)
      parts.push({
        key,
        kind,
        mimeType,
        filename,
        digest: await digestOf(content),
        pageCount: 0,
        firstPage: 0,
        attached: true,
        content,
      })
      continue
    }

    parts.push({
      key,
      kind,
      mimeType,
      filename,
      digest: await digestOf(flat),
      pageCount,
      firstPage: packetPages + 1,
      attached: false,
      content: flat,
    })

    for (const field of sealed?.map ?? []) {
      located.push({ key, field, firstPage: packetPages + 1 })
    }

    pdfParts.push(flat)
    packetPages += pageCount
  }

  if (pdfParts.length === 0) {
    throw new BundleSealError(
      `Cannot seal bundle: no part reached a PDF, so there is no packet to sign. Unpaintable: ${unmergeable.join(', ')}.`,
      unmergeable,
    )
  }

  // A part binds signer ids in its own namespace, so the packet scopes them.
  // Two parts that both call a signer `signer-1` are two people until the
  // caller says otherwise.
  const mapping = options.signers ?? {}
  const scoped = new Set(located.map(({ key, field }) => `${key}/${field.signerId}`))
  const unknown = Object.keys(mapping).filter((name) => !scoped.has(name))
  if (unknown.length > 0) {
    const problem =
      `the signer mapping names ${unknown.join(', ')}, which no part binds. ` +
      `The packet's part signers are ${[...scoped].join(', ')}.`
    throw new BundleSealError(`Cannot seal bundle: ${problem}`, [problem])
  }

  const signers: PacketSigner[] = []
  const byId = new Map<string, PacketSigner>()
  const signatureMap: PacketSigningField[] = []
  for (const { key, field, firstPage } of located) {
    const partSigner = `${key}/${field.signerId}`
    const id = mapping[partSigner] ?? partSigner
    let signer = byId.get(id)
    if (!signer) {
      signer = { id, index: signers.length, parts: [] }
      byId.set(id, signer)
      signers.push(signer)
    }
    if (!signer.parts.includes(partSigner)) signer.parts.push(partSigner)
    signatureMap.push({
      ...field,
      id: `${key}/${field.id}`,
      part: key,
      slot: field.id,
      partSignerId: field.signerId,
      signerId: id,
      signerIndex: signer.index,
      partPage: field.page,
      page: field.page + firstPage - 1,
    })
  }
  signatureMap.sort((left, right) =>
    left.signerIndex === right.signerIndex ? left.page - right.page : left.signerIndex - right.signerIndex,
  )

  const pdf = await mergePdfs(pdfParts)
  const canonicalPdfHash = await digestOf(pdf)

  // The packet's record covers the merged document and everything beside it, so
  // an attachment nobody can paint is still accounted for. It is not what a
  // signer signs: that is the merged document, and its hash is above.
  const manifest = [
    `packet ${bundle.name} ${canonicalPdfHash}`,
    ...parts.map((part) =>
      [part.key, part.kind, part.mimeType, part.filename, String(part.pageCount), part.digest].join(' '),
    ),
  ].join('\n')

  return {
    bundle,
    pdf,
    canonicalPdfHash,
    packetHash: await digestOf(encoder.encode(manifest)),
    signers,
    signatureMap,
    parts,
    warnings,
  }
}
