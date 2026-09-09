import type { ParadocToolsConfig } from '../config'
import type { GetRegistryInput, GetRegistryOutput } from '../contracts'
import { errorFromUnknown } from '../errors'
import { normalizeGetRegistryInput } from '../input'
import { fetchRegistryIndex, registryUrlFromConfig } from '../registry-client'

export async function executeGetRegistry(
	input: GetRegistryInput | Record<string, unknown> = {},
	config?: ParadocToolsConfig,
): Promise<GetRegistryOutput> {
	const normalized = normalizeGetRegistryInput(input)
	const registryUrl = registryUrlFromConfig(normalized.registry_url, config)
	if (!registryUrl) {
		return { items: [], error: { code: 'missing_registry_url', message: 'registry_url is required, or configure defaultRegistryUrl.' } }
	}
	try {
		const index = await fetchRegistryIndex(registryUrl, config?.fetch, config)
		return {
			registry_url: registryUrl,
			...(index.artifactsPath ? { artifacts_path: index.artifactsPath } : {}),
			items: index.items,
		}
	} catch (error) {
		return { registry_url: registryUrl, items: [], error: errorFromUnknown(error, 'registry_fetch_error') }
	}
}
