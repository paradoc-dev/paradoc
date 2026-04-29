import { buildArtifactItemUrl, fetchRegistryIndex, fetchRegistryItem, safeFetch } from '../registry-client'
import type { GetArtifactInput } from '../schemas/get-artifact'
import type { GetArtifactOutput } from '../types'
import type { ParadocToolsConfig } from '../config'

const MAX_INSTRUCTIONS_SIZE = 5_242_880 // 5 MB

type ContentRef =
  | { kind: 'inline'; text: string }
  | { kind: 'file'; path: string; mimeType: string; title?: string; description?: string; checksum?: string }

function isInlineContentRef(value: unknown): value is { kind: 'inline'; text: string } {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return v.kind === 'inline' && typeof v.text === 'string'
}

function isFileContentRef(value: unknown): value is { kind: 'file'; path: string; mimeType: string } {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return v.kind === 'file' && typeof v.path === 'string' && typeof v.mimeType === 'string'
}

function getContentRef(artifact: Record<string, unknown>, key: 'instructions' | 'agentInstructions'): ContentRef | undefined {
  const value = artifact[key]
  if (isInlineContentRef(value)) return value
  if (isFileContentRef(value)) return value
  return undefined
}

function shouldTreatAsText(mimeType: string): boolean {
  return (
    mimeType.startsWith('text/') ||
    mimeType.includes('json') ||
    mimeType.includes('xml') ||
    mimeType.includes('yaml') ||
    mimeType.includes('markdown')
  )
}

async function resolveContentRef(
  ref: ContentRef,
  artifactItemUrl: string,
  customFetch?: typeof globalThis.fetch,
): Promise<NonNullable<GetArtifactOutput['instructions']>> {
  if (ref.kind === 'inline') {
    return {
      kind: 'inline',
      content: ref.text,
      encoding: 'utf-8',
    }
  }

  const artifactHost = new URL(artifactItemUrl).host
  const resolvedUrl = new URL(ref.path, artifactItemUrl)
  if (resolvedUrl.host !== artifactHost) {
    throw new Error(`Instruction path escaped registry host: ${ref.path}`)
  }

  const res = await safeFetch(resolvedUrl.toString(), MAX_INSTRUCTIONS_SIZE, customFetch)
  const bytes = new Uint8Array(await res.arrayBuffer())

  if (shouldTreatAsText(ref.mimeType)) {
    return {
      kind: 'file',
      mimeType: ref.mimeType,
      path: ref.path,
      content: new TextDecoder().decode(bytes),
      encoding: 'utf-8',
    }
  }

  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return {
    kind: 'file',
    mimeType: ref.mimeType,
    path: ref.path,
    content: btoa(binary),
    encoding: 'base64',
  }
}

export async function executeGetArtifact(
  input: GetArtifactInput,
  config?: ParadocToolsConfig,
): Promise<GetArtifactOutput> {
  try {
    const index = await fetchRegistryIndex(input.registryUrl, config?.fetch)
    const indexItem = index.items.find((item) => item.name === input.artifactName)

    if (!indexItem) {
      return {
        error: `Artifact "${input.artifactName}" not found in registry. Available: ${index.items.map((i) => i.name).join(', ')}`,
      }
    }

    const artifact = await fetchRegistryItem(
      input.registryUrl,
      index.artifactsPath,
      input.artifactName,
      indexItem.path,
      config?.fetch,
    )
    const artifactItemUrl = buildArtifactItemUrl(
      input.registryUrl,
      index.artifactsPath,
      input.artifactName,
      indexItem.path,
    )

    const instructionsRef = getContentRef(artifact, 'instructions')
    const agentInstructionsRef = getContentRef(artifact, 'agentInstructions')

    const instructions = instructionsRef
      ? await resolveContentRef(instructionsRef, artifactItemUrl, config?.fetch)
      : undefined
    const agentInstructions = agentInstructionsRef
      ? await resolveContentRef(agentInstructionsRef, artifactItemUrl, config?.fetch)
      : undefined

    return {
      artifact,
      artifactName: input.artifactName,
      instructions,
      agentInstructions,
    }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
