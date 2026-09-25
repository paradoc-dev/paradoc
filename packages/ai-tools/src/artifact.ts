import type { FormPayload } from './contracts'
import type { ParadocToolsConfig } from './config'
import { createHttpResolver } from '@paradoc/resolvers/http'
import { bytesToBase64, fetchPolicyFromConfig, MAX_LAYER_FILE_SIZE, safeFetch } from './registry-client'

export type ArtifactKind = 'form' | 'document' | 'bundle' | 'checklist'

export function artifactKind(artifact: Record<string, unknown>): ArtifactKind | undefined {
	const kind = artifact.kind
	return kind === 'form' || kind === 'document' || kind === 'bundle' || kind === 'checklist' ? kind : undefined
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function asFormPayload(value: unknown): FormPayload {
	if (!isRecord(value)) return { fields: {} }
	const fields = isRecord(value.fields) ? structuredClone(value.fields) : {}
	const payload: FormPayload = { fields }
	if (isRecord(value.parties)) payload.parties = structuredClone(value.parties)
	if (isRecord(value.annexes)) payload.annexes = structuredClone(value.annexes)
	for (const [key, entry] of Object.entries(value)) {
		if (!(key in payload)) payload[key] = structuredClone(entry)
	}
	return payload
}

export function asChecklistPayload(value: unknown): Record<string, boolean | string> {
	if (!isRecord(value)) return {}
	return structuredClone(value) as Record<string, boolean | string>
}

export function formDraftPayload(draft: {
	fields: Record<string, unknown>
	parties: Record<string, unknown>
	annexes: Record<string, unknown>
	signers?: Record<string, unknown>
	signatories?: Record<string, unknown>
}): FormPayload {
	const payload: FormPayload = {
		fields: structuredClone(draft.fields),
		parties: structuredClone(draft.parties),
	}
	if (Object.keys(draft.annexes).length > 0) payload.annexes = structuredClone(draft.annexes)
	if (draft.signers && Object.keys(draft.signers).length > 0) payload.signers = structuredClone(draft.signers)
	if (draft.signatories && Object.keys(draft.signatories).length > 0) payload.signatories = structuredClone(draft.signatories)
	return payload
}

export function contextSnapshot(value: unknown): Record<string, unknown> | undefined {
	if (!isRecord(value)) return undefined
	return structuredClone(value)
}

export function contextOptions(value: unknown): { context?: import('@paradoc/core').RuntimeContextOptions } | undefined {
	const context = contextSnapshot(value)
	return context ? { context: { asOf: context.asOf as import('@paradoc/core').RuntimeContextOptions['asOf'] } } : undefined
}

export function encodeOutput(bytes: Uint8Array | string): { content: string; encoding: 'utf-8' | 'base64'; byte_length: number } {
	if (typeof bytes === 'string') return { content: bytes, encoding: 'utf-8', byte_length: new TextEncoder().encode(bytes).byteLength }
	return { content: bytesToBase64(bytes), encoding: 'base64', byte_length: bytes.byteLength }
}

/** Resolve layer files beneath the artifact's base URL through the tools' fetch policy. */
export function makeResolver(base_url: string | undefined, config?: ParadocToolsConfig) {
	if (!base_url) return undefined
	const policy = fetchPolicyFromConfig(config)
	return createHttpResolver({
		baseUrl: base_url,
		fetch: (url) => safeFetch(url, MAX_LAYER_FILE_SIZE, config?.fetch, policy),
	})
}

export function boundedPresentation(
	value: { content?: string; encoding?: 'utf-8' | 'base64'; byte_length?: number },
	options: { max_bytes?: number; include_content?: boolean } | undefined,
): { content?: string; byte_length?: number; truncated?: boolean } {
	if (!value.content) return { byte_length: value.byte_length }
	const maxBytes = options?.max_bytes
	const includeContent = options?.include_content !== false
	if (!includeContent) return { byte_length: value.byte_length, truncated: true }
	if (!maxBytes || !Number.isFinite(maxBytes)) return { content: value.content, byte_length: value.byte_length }
	if (value.encoding === 'utf-8') {
		const bytes = new TextEncoder().encode(value.content)
		if (bytes.byteLength <= maxBytes) return { content: value.content, byte_length: value.byte_length }
		return { content: new TextDecoder().decode(bytes.slice(0, maxBytes)), byte_length: value.byte_length, truncated: true }
	}
	// Base64 output must remain decodable. Trim to the largest complete 4-byte group.
	const chars = Math.floor(maxBytes / 3) * 4
	if (chars === 0) return { content: '', byte_length: value.byte_length, truncated: value.content.length > 0 }
	return {
		content: value.content.slice(0, chars),
		byte_length: value.byte_length,
		truncated: value.content.length > chars,
	}
}
