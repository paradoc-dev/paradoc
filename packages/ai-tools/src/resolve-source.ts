import type { SourceInput } from './schemas/source'
import type { ParadocToolsConfig } from './config'
import { safeFetch, fetchRegistryIndex, fetchRegistryItem, buildArtifactItemUrl, MAX_ITEM_SIZE } from './registry-client'

export interface ResolvedSource {
  artifact: Record<string, unknown>
  baseUrl?: string
}

export async function resolveSource(input: SourceInput, config?: ParadocToolsConfig): Promise<ResolvedSource> {
  if (input.source === 'artifact') {
    return { artifact: input.artifact, baseUrl: input.baseUrl }
  }

  if (input.source === 'url') {
    const res = await safeFetch(input.url, MAX_ITEM_SIZE, config?.fetch)
    const artifact = (await res.json()) as Record<string, unknown>
    const baseUrl = input.url.substring(0, input.url.lastIndexOf('/'))
    return { artifact, baseUrl }
  }

  // source === 'registry'
  const index = await fetchRegistryIndex(input.registryUrl, config?.fetch)
  const indexItem = index.items.find((item) => item.name === input.artifactName)

  const artifact = await fetchRegistryItem(
    input.registryUrl,
    index.artifactsPath,
    input.artifactName,
    indexItem?.path,
    config?.fetch,
  )

  const artifactItemUrl = buildArtifactItemUrl(
    input.registryUrl,
    index.artifactsPath,
    input.artifactName,
    indexItem?.path,
  )
  const baseUrl = artifactItemUrl.substring(0, artifactItemUrl.lastIndexOf('/'))

  return { artifact, baseUrl }
}
