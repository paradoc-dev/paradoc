import type { ParadocToolsConfig } from '../config'
import { ExtractInputSchema, type ExtractInput, type ExtractOutput } from '../contracts'
import { artifactKind } from '../artifact'
import { errorFromUnknown, toolError } from '../errors'
import { fetchPolicyFromConfig, MAX_LAYER_FILE_SIZE, safeFetch } from '../registry-client'
import { resolveSource } from '../resolve-source'

class ExtractInputError extends Error {
	constructor(readonly code: string, message: string) {
		super(message)
	}
}

function base64ToBytes(value: string): Uint8Array {
	const text = value.replace(/\s/g, '')
	if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text) || text.length % 4 === 1) {
		throw new ExtractInputError('invalid_input', 'pdf must be base64-encoded.')
	}
	const size = Math.floor((text.length * 3) / 4) - (text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0)
	if (size > MAX_LAYER_FILE_SIZE) {
		throw new ExtractInputError('pdf_too_large', `The PDF is ${size} bytes; the limit is ${MAX_LAYER_FILE_SIZE}.`)
	}
	const binary = globalThis.atob(text)
	const bytes = new Uint8Array(binary.length)
	for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
	return bytes
}

async function pdfBytes(input: ExtractInput, config?: ParadocToolsConfig): Promise<Uint8Array> {
	const hasInline = typeof input.pdf === 'string' && input.pdf.length > 0
	const hasUrl = typeof input.pdf_url === 'string' && input.pdf_url.length > 0
	if (hasInline === hasUrl) throw new ExtractInputError('invalid_input', 'Give the filled PDF as exactly one of pdf (base64) or pdf_url.')
	if (hasInline) return base64ToBytes(input.pdf!)
	const response = await safeFetch(input.pdf_url!, MAX_LAYER_FILE_SIZE, config?.fetch, fetchPolicyFromConfig(config))
	return new Uint8Array(await response.arrayBuffer())
}

export async function executeExtract(
	input: ExtractInput | Record<string, unknown>,
	config?: ParadocToolsConfig,
): Promise<ExtractOutput> {
	try {
		const normalized = ExtractInputSchema.parse(input)
		const { isForm, loadFromObject, validate } = await import('@paradoc/core')
		const { artifact } = await resolveSource(normalized, config)
		const kind = artifactKind(artifact)
		const validation = validate(artifact)
		if (validation.issues) {
			return {
				success: false,
				...(kind ? { artifact_kind: kind } : {}),
				validation_issues: validation.issues.map((issue) => ({ message: issue.message, path: issue.path as Array<string | number> | undefined })),
				error: toolError('invalid_artifact', 'Artifact failed schema validation.'),
			}
		}
		if (!isForm(artifact)) {
			return {
				success: false,
				...(kind ? { artifact_kind: kind } : {}),
				error: toolError('unsupported_artifact', 'Extraction reads filled PDF forms, so it needs a form artifact.'),
			}
		}

		const pdf = await pdfBytes(normalized, config)
		const result = await loadFromObject<'form'>(artifact).extract(pdf, { layer: normalized.layer })
		return {
			success: true,
			artifact_kind: 'form',
			layer: result.layer,
			data: result.data as unknown as Record<string, unknown>,
			report: result.report,
		}
	} catch (error) {
		return { success: false, error: errorFromUnknown(error, 'extract_error') }
	}
}
