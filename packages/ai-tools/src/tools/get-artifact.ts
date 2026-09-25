import type { ParadocToolsConfig } from '../config'
import type { GetArtifactInput, GetArtifactOutput, InstructionContent } from '../contracts'
import { errorFromUnknown } from '../errors'
import { normalizeGetArtifactInput } from '../input'
import {
	bytesToBase64,
	bytesToText,
	fetchPolicyFromConfig,
	MAX_INSTRUCTIONS_SIZE,
	registryUrlFromConfig,
	resolveRelativeUrl,
	safeFetch,
} from '../registry-client'
import { resolveRegistryArtifact } from '../resolve-source'

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
	const normalized = normalizeGetArtifactInput(input)
	const registryUrl = registryUrlFromConfig(normalized.registry_url, config)
	if (!registryUrl) return { error: { code: 'missing_registry_url', message: 'registry_url is required, or configure defaultRegistryUrl.' } }
	try {
		const resolved = await resolveRegistryArtifact(registryUrl, normalized.artifact_name, config)
		if (!resolved) return { artifact_name: normalized.artifact_name, error: { code: 'artifact_not_found', message: `Artifact "${normalized.artifact_name}" not found in registry.` } }
		const { artifact, artifact_url: artifactUrl, base_url } = resolved
		const { assertCurrentSchemaVersion } = await import('@paradoc/core')
		assertCurrentSchemaVersion(artifact, { required: true })
		if (!artifactUrl) throw new Error('Resolved registry artifact has no source URL')
		const output: GetArtifactOutput = {
			artifact,
			artifact_name: normalized.artifact_name,
			base_url,
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
		return { artifact_name: normalized.artifact_name, error: errorFromUnknown(error, 'artifact_fetch_error') }
	}
}
