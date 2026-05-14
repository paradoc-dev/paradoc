import { fetchRegistryIndex } from '../registry-client'
import type { GetRegistryInput } from '../schemas/get-registry'
import type { GetRegistryOutput } from '../types'
import type { ParadocToolsConfig } from '../config'

export async function executeGetRegistry(
  input: GetRegistryInput,
  config?: ParadocToolsConfig,
): Promise<GetRegistryOutput> {
  try {
    const index = await fetchRegistryIndex(input.registryUrl, config?.fetch)
    return {
      name: input.registryUrl,
      artifactsPath: index.artifactsPath,
      items: index.items,
    }
  } catch (err) {
    return {
      items: [],
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
