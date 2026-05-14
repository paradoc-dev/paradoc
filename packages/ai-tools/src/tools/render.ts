import {
  isForm,
  isBundle,
  isChecklist,
  isDocument,
  loadFromObject,
  FormValidationError,
  validate,
  textRenderer,
  pdfRenderer,
  docxRenderer,
} from '@paradoc/sdk'
import type { Resolver } from '@paradoc/sdk'
import type { RenderInput } from '../schemas/render'
import type { RenderOutput } from '../types'
import type { ParadocToolsConfig, ProxyTextRendererConfig } from '../config'
import { safeFetch } from '../registry-client'
import { resolveSource } from '../resolve-source'
import { proxyTextRenderer } from '../proxy-text-renderer'

const MAX_LAYER_FILE_SIZE = 20_971_520 // 20 MB

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRegistryResolver(baseUrl: string, customFetch?: typeof globalThis.fetch): Resolver {
  const base = baseUrl.replace(/\/$/, '')
  return {
    async read(path: string): Promise<Uint8Array> {
      const url = `${base}/${path}`
      const res = await safeFetch(url, MAX_LAYER_FILE_SIZE, customFetch)
      return new Uint8Array(await res.arrayBuffer())
    },
  }
}

function selectRenderer(mimeType: string, proxyConfig?: ProxyTextRendererConfig, customFetch?: typeof globalThis.fetch) {
  if (mimeType.startsWith('text/')) {
    return proxyConfig ? proxyTextRenderer(proxyConfig, customFetch) : textRenderer()
  }
  if (mimeType === 'application/pdf') return pdfRenderer()
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    return docxRenderer()
  throw new Error(`Unsupported layer mimeType: ${mimeType}`)
}

function detectKind(artifact: unknown): string | undefined {
  if (isForm(artifact)) return 'form'
  if (isBundle(artifact)) return 'bundle'
  if (isDocument(artifact)) return 'document'
  if (isChecklist(artifact)) return 'checklist'
  return undefined
}

function normalizeParties(data: Record<string, unknown>): Record<string, unknown> {
  const partiesValue = data.parties
  if (!partiesValue || typeof partiesValue !== 'object' || Array.isArray(partiesValue)) {
    return data
  }

  const partiesRecord = partiesValue as Record<string, unknown>
  const normalizedParties: Record<string, unknown> = {}
  let mutated = false

  for (const [partyKey, partyValue] of Object.entries(partiesRecord)) {
    if (!partyValue || typeof partyValue !== 'object' || Array.isArray(partyValue)) {
      normalizedParties[partyKey] = partyValue
      continue
    }

    const partyObject = partyValue as Record<string, unknown>
    if (typeof partyObject.id === 'string' && partyObject.id.length > 0) {
      normalizedParties[partyKey] = partyObject
      continue
    }

    normalizedParties[partyKey] = { ...partyObject, id: `${partyKey}-0` }
    mutated = true
  }

  if (!mutated) return data
  return { ...data, parties: normalizedParties }
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

export async function executeRender(
  input: RenderInput,
  config?: ParadocToolsConfig,
): Promise<RenderOutput> {
  try {
    const { artifact, baseUrl } = await resolveSource(input, config)
    const { layer } = input
    const data = normalizeParties(input.data as Record<string, unknown>)

    const artifactKind = detectKind(artifact)

    // Validate artifact schema
    const validationResult = validate(artifact)
    if (validationResult.issues) {
      return {
        success: false,
        artifactKind,
        validationIssues: validationResult.issues.map((issue) => ({
          message: issue.message,
          path: issue.path as (string | number)[] | undefined,
        })),
        error: 'Artifact failed schema validation',
      }
    }

    // Only forms are supported for rendering
    if (!isForm(artifact)) {
      return { success: false, artifactKind, error: 'Only form artifacts can be rendered' }
    }

    // Load and fill
    const instance = loadFromObject<'form'>(artifact)
    const fillResult = instance.safeFill(data as Record<string, unknown>)

    if (!fillResult.success) {
      const errors =
        fillResult.error instanceof FormValidationError
          ? fillResult.error.errors.map((e: { field: string; message: string }) => ({ field: e.field, message: e.message }))
          : [{ field: 'root', message: fillResult.error.message }]
      return { success: false, artifactKind, errors }
    }

    const draftForm = fillResult.data

    // Resolve layer key
    const layers = (artifact as Record<string, unknown>).layers as
      | Record<string, { kind: string; mimeType: string; path?: string }>
      | undefined
    if (!layers || Object.keys(layers).length === 0) {
      return { success: false, artifactKind, error: 'Form has no layers defined' }
    }

    const layerKey =
      layer ||
      ((artifact as Record<string, unknown>).defaultLayer as string | undefined) ||
      Object.keys(layers)[0]
    if (!layerKey || !layers[layerKey]) {
      return {
        success: false,
        artifactKind,
        error: `Layer "${layerKey ?? ''}" not found. Available layers: ${Object.keys(layers).join(', ')}`,
      }
    }

    const layerSpec = layers[layerKey]
    const mimeType = layerSpec.mimeType

    // File-backed layers need a base URL for resolution
    if (layerSpec.kind === 'file' && !baseUrl) {
      return {
        success: false,
        artifactKind,
        error: `Layer "${layerKey}" is file-backed but no base URL is available for resolution`,
      }
    }

    const renderer = selectRenderer(mimeType, config?.proxyTextRenderer, config?.fetch) as {
      id: string
      render(req: unknown): Promise<string | Uint8Array>
    }

    const resolver = baseUrl ? createRegistryResolver(baseUrl, config?.fetch) : undefined

    const output: string | Uint8Array = await draftForm.render({ renderer, resolver, layer: layerKey })

    // Always inline output (no R2/links)
    const isBinary = typeof output !== 'string'

    if (isBinary) {
      const bytes = output as Uint8Array
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]!)
      }
      return {
        success: true,
        artifactKind,
        content: btoa(binary),
        encoding: 'base64',
        mimeType,
      }
    }

    return {
      success: true,
      artifactKind,
      content: output as string,
      encoding: 'utf-8',
      mimeType,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown render error',
    }
  }
}
