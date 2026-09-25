import type { ParadocToolsConfig } from '../config'
import { GetArtifactInputSchema, type GetArtifactInput, type GetArtifactOutput, type InstructionContent } from '../contracts'
import { errorFromUnknown } from '../errors'
import {
	buildArtifactItemUrl,
	bytesToBase64,
	bytesToText,
	fetchRegistryIndexResponse,
	fetchRegistryItemResponse,
	fetchPolicyFromConfig,
	MAX_INSTRUCTIONS_SIZE,
	registryUrlFromConfig,
	resolveRelativeUrl,
	safeFetch,
} from '../registry-client'

type ContentRef =
	| { kind: 'inline'; text: string }
	| { kind: 'file'; path: string; mimeType: string; title?: string; description?: string; checksum?: string }

function contentRef(value: unknown): ContentRef | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
	const ref = value as Record<string, unknown>
	if (ref.kind === 'inline' && typeof ref.text === 'string') return { kind: 'inline', text: ref.text }
	if (ref.kind === 'file' && typeof ref.path === 'string' && typeof ref.mimeType === 'string') {
		return { kind: 'file', path: ref.path, mimeType: ref.mimeType }
	}
	return undefined
}

function isText(mimeType: string): boolean {
	return mimeType.startsWith('text/') || /json|xml|yaml|markdown/i.test(mimeType)
}

async function resolveRef(ref: ContentRef, artifactUrl: string, config?: ParadocToolsConfig): Promise<InstructionContent> {
	if (ref.kind === 'inline') return { kind: 'inline', content: ref.text, encoding: 'utf-8' }
	const url = resolveRelativeUrl(new URL('.', artifactUrl).toString(), ref.path, 'Instruction path')
	const response = await safeFetch(url.toString(), MAX_INSTRUCTIONS_SIZE, config?.fetch, fetchPolicyFromConfig(config))
	const bytes = new Uint8Array(await response.arrayBuffer())
	return {
		kind: 'file',
		mime_type: ref.mimeType,
		path: ref.path,
		content: isText(ref.mimeType) ? bytesToText(bytes) : bytesToBase64(bytes),
		encoding: isText(ref.mimeType) ? 'utf-8' : 'base64',
	}
}

export async function executeGetArtifact(
	input: GetArtifactInput | Record<string, unknown>,
	config?: ParadocToolsConfig,
): Promise<GetArtifactOutput> {
	try {
		const normalized = GetArtifactInputSchema.parse(input)
		const registryUrl = registryUrlFromConfig(normalized.registry_url, config)
		if (!registryUrl) return { error: { code: 'missing_registry_url', message: 'registry_url is required, or configure defaultRegistryUrl.' } }
		const resolvedIndex = await fetchRegistryIndexResponse(registryUrl, config?.fetch, config)
		const index = resolvedIndex.index
		const resolvedRegistryUrl = new URL('.', resolvedIndex.response.url || new URL('registry.json', `${registryUrl.replace(/\/$/, '')}/`).toString()).toString().replace(/\/$/, '')
		const indexItem = index.items.find((item) => item.name === normalized.artifact_name)
		if (!indexItem) return { artifact_name: normalized.artifact_name, error: { code: 'artifact_not_found', message: `Artifact "${normalized.artifact_name}" not found in registry.` } }
		const requestedArtifactUrl = buildArtifactItemUrl(resolvedRegistryUrl, index.artifactsPath, normalized.artifact_name, indexItem.path)
		const resolvedItem = await fetchRegistryItemResponse(resolvedRegistryUrl, index.artifactsPath, normalized.artifact_name, indexItem.path, config?.fetch, config)
		const artifact = resolvedItem.artifact
		const { assertCurrentSchemaVersion } = await import('@paradoc/core')
		assertCurrentSchemaVersion(artifact, { required: true })
		const artifactUrl = resolvedItem.response.url || requestedArtifactUrl
		const output: GetArtifactOutput = {
			artifact,
			artifact_name: normalized.artifact_name,
			base_url: new URL('.', artifactUrl).toString().replace(/\/$/, ''),
		}
		if (normalized.include_instructions !== false) {
			const ref = contentRef(artifact.instructions)
			if (ref) output.instructions = await resolveRef(ref, artifactUrl, config)
		}
		if (normalized.include_agent_instructions !== false) {
			const ref = contentRef(artifact.agentInstructions)
			if (ref) output.agent_instructions = await resolveRef(ref, artifactUrl, config)
		}
		return output
	} catch (error) {
		const artifactName = input && typeof input === 'object' && 'artifact_name' in input && typeof input.artifact_name === 'string'
			? input.artifact_name
			: undefined
		return { ...(artifactName ? { artifact_name: artifactName } : {}), error: errorFromUnknown(error, 'artifact_fetch_error') }
	}
}
