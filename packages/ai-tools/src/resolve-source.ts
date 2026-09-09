import type { ParadocToolsConfig } from './config'
import type { SourceInput } from './contracts'
import { normalizeSource } from './input'
import {
	buildArtifactItemUrl,
	fetchRegistryIndexResponse,
	fetchRegistryItemResponse,
	MAX_ITEM_SIZE,
	registryUrlFromConfig,
	safeFetch,
} from './registry-client'

export interface ResolvedSource {
	artifact: Record<string, unknown>
	base_url?: string
	artifact_url?: string
}

function requireRegistryUrl(input: string | undefined, config?: ParadocToolsConfig): string {
	const registryUrl = registryUrlFromConfig(input, config)
	if (!registryUrl) throw new Error('A registry_url is required, or configure defaultRegistryUrl.')
	return registryUrl
}

function artifactBaseUrl(artifactUrl: string): string {
	const url = new URL(artifactUrl)
	url.pathname = url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1)
	url.search = ''
	url.hash = ''
	return url.toString().replace(/\/$/, '')
}

function registryBaseFromIndexUrl(indexUrl: string): string {
	return new URL('.', indexUrl).toString().replace(/\/$/, '')
}

export async function resolveSource(
	input: SourceInput | Record<string, unknown>,
	config?: ParadocToolsConfig,
): Promise<ResolvedSource> {
	const source = normalizeSource(input)
	if (source.source === 'artifact') {
		return { artifact: source.artifact, base_url: source.base_url }
	}

	if (source.source === 'url') {
		const response = await safeFetch(source.url, MAX_ITEM_SIZE, config?.fetch, {
			allowLocalDevelopment: config?.allowLocalDevelopment,
			approvedOrigins: config?.approvedOrigins,
			maxRedirects: config?.maxRedirects,
			context: config?.context,
			signal: config?.signal,
		})
		const artifact = await response.json()
		if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
			throw new Error('Artifact URL must return a JSON object')
		}
		const finalArtifactUrl = response.url || source.url
		return { artifact: artifact as Record<string, unknown>, base_url: artifactBaseUrl(finalArtifactUrl), artifact_url: finalArtifactUrl }
	}

	const registryUrl = requireRegistryUrl(source.registry_url, config)
	const resolvedIndex = await fetchRegistryIndexResponse(registryUrl, config?.fetch, config)
	const index = resolvedIndex.index
	const resolvedRegistryUrl = registryBaseFromIndexUrl(resolvedIndex.response.url || new URL('registry.json', `${registryUrl.replace(/\/$/, '')}/`).toString())
	const indexItem = index.items.find((item) => item.name === source.artifact_name)
	if (!indexItem) {
		throw new Error(`Artifact "${source.artifact_name}" not found in registry`)
	}
	const artifactUrl = buildArtifactItemUrl(resolvedRegistryUrl, index.artifactsPath, source.artifact_name, indexItem.path)
	const resolvedItem = await fetchRegistryItemResponse(
		resolvedRegistryUrl,
		index.artifactsPath,
		source.artifact_name,
		indexItem.path,
		config?.fetch,
		config,
	)
	const finalArtifactUrl = resolvedItem.response.url || artifactUrl
	return { artifact: resolvedItem.artifact, base_url: artifactBaseUrl(finalArtifactUrl), artifact_url: finalArtifactUrl }
}
