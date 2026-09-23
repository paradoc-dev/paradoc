/**
 * Authoring validation of template expressions in an artifact's layers.
 *
 * Text, Markdown, HTML, and DOCX templates are written in the artifact
 * expression language, so they are checked against the same type environment
 * as the artifact's field logic. Inline layers are checked synchronously, as
 * part of `validate()`; file layers are read through a resolver by
 * `validateLayers()`.
 */

import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { Checklist, Form, Layer, Resolver } from '@paradoc/types'
import { createTypeEnv, T, type ExprType, type TypeEnv } from '@paradoc/expr'
import { checkTextTemplate, type TemplateDiagnostic } from '@paradoc/render/text'
import { checkDocxTemplate } from '@paradoc/render/docx'
import { buildFormTypeAcc, registerPartyTypes } from '../type-checking/build-type-environment'

const TEXT_MIME_TYPES = new Set(['text/plain', 'text/markdown', 'text/html'])
const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** An artifact whose layers carry templates. */
export interface TemplateArtifact {
  kind: string
  layers?: Record<string, Layer>
  [key: string]: unknown
}

/** Members of a party's signatories, which templates loop over to place signing marks. */
const SIGNATORY_MEMBERS: Record<string, ExprType> = {
  signatories: T.array(T.object),
  'signatories.signerId': T.string,
  'signatories.capacity': T.string,
  'signatories.signer': T.object,
  'signatories.signer.person': T.object,
  'signatories.signer.person.name': T.string,
  'signatories.signer.person.firstName': T.string,
  'signatories.signer.person.middleName': T.string,
  'signatories.signer.person.lastName': T.string,
}

/**
 * The type environment template expressions are checked against: a form's
 * fields, computed values, and parties (with their signatories, which only
 * templates read); a checklist's items; nothing more for a document.
 */
export function buildTemplateTypeEnvironment(artifact: TemplateArtifact): TypeEnv {
  if (artifact.kind === 'form') {
    const form = artifact as unknown as Form
    const acc = buildFormTypeAcc(form)
    registerPartyTypes(form.parties, acc, SIGNATORY_MEMBERS)
    return createTypeEnv(acc)
  }
  if (artifact.kind === 'checklist') {
    const acc: Record<string, ExprType> = { items: T.object }
    const items = (artifact as unknown as Checklist).items
    for (const item of Array.isArray(items) ? items : []) {
      acc[`items.${item.id}`] = item.status?.kind === 'enum' ? T.string : T.boolean
    }
    return createTypeEnv(acc)
  }
  return createTypeEnv({})
}

function issueFor(key: string, diagnostic: TemplateDiagnostic): StandardSchemaV1.Issue {
  const where = [
    `layer "${key}"`,
    diagnostic.location,
    diagnostic.position ? `line ${diagnostic.position.line}, column ${diagnostic.position.column}` : undefined,
  ].filter(Boolean).join(', ')
  const expression = diagnostic.expression === undefined ? '' : ` in {{${diagnostic.expression}}}`
  return { message: `Template error at ${where}${expression}: ${diagnostic.message}`, path: ['layers', key] }
}

function isTextLayer(layer: Layer): boolean {
  return TEXT_MIME_TYPES.has(layer.mimeType.toLowerCase())
}

/** Check the template expressions of every inline text layer. */
export function validateInlineTemplates(artifact: TemplateArtifact): StandardSchemaV1.Issue[] {
  const layers = Object.entries(artifact.layers ?? {}).filter(([, layer]) => layer.kind === 'inline' && isTextLayer(layer))
  if (layers.length === 0) return []
  const env = buildTemplateTypeEnvironment(artifact)
  return layers.flatMap(([key, layer]) =>
    checkTextTemplate((layer as Extract<Layer, { kind: 'inline' }>).text, env).map((diagnostic) => issueFor(key, diagnostic)))
}

/**
 * Check the template expressions of every file-backed text and DOCX layer,
 * reading each through the resolver. A layer the resolver cannot read is
 * reported as an issue naming its path.
 */
export async function validateFileTemplates(artifact: TemplateArtifact, resolver: Resolver): Promise<StandardSchemaV1.Issue[]> {
  const layers = Object.entries(artifact.layers ?? {}).filter(([, layer]) =>
    layer.kind === 'file' && (isTextLayer(layer) || layer.mimeType.toLowerCase() === DOCX_MIME_TYPE))
  if (layers.length === 0) return []
  const env = buildTemplateTypeEnvironment(artifact)
  const issues: StandardSchemaV1.Issue[] = []
  for (const [key, layer] of layers) {
    const path = (layer as Extract<Layer, { kind: 'file' }>).path
    let bytes: Uint8Array
    try {
      bytes = await resolver.read(path)
    } catch (error) {
      issues.push({ message: `Layer "${key}" could not be read from "${path}": ${error instanceof Error ? error.message : String(error)}`, path: ['layers', key] })
      continue
    }
    const diagnostics = isTextLayer(layer)
      ? checkTextTemplate(new TextDecoder().decode(bytes), env)
      : checkDocxTemplate(bytes, env)
    issues.push(...diagnostics.map((diagnostic) => issueFor(key, diagnostic)))
  }
  return issues
}
