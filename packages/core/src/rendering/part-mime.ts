// packages/core/src/rendering/part-mime.ts

import { isReactLayerMimeType } from './renderer-registry'

/**
 * The MIME type of what a layer's renderer actually produced.
 *
 * A layer's declared type describes its source, and for most layers the source
 * and the output are the same thing. A React layer is the exception: it is a
 * `text/tsx` pointer at a composition, and the renderer registered for it
 * writes a PDF. The layer's own type would name the packet's part after the
 * module that drew it, so the produced type is asked for separately.
 */
export function producedMimeType(layerMimeType: string): string {
  return isReactLayerMimeType(layerMimeType) ? 'application/pdf' : normalizeMimeType(layerMimeType)
}

/**
 * A MIME type in the one case every comparison uses.
 *
 * MIME types are case-insensitive, and a layer or an annex may declare
 * `Application/PDF`. Parts are named and compared through this, so the
 * declared spelling never changes what a part is.
 */
export function normalizeMimeType(mimeType: string): string {
  return mimeType.toLowerCase()
}

const EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  'text/markdown': 'md',
  'text/html': 'html',
  'text/plain': 'txt',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/json': 'json',
  'text/yaml': 'yaml',
  'application/yaml': 'yaml',
  'text/csv': 'csv',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/tiff': 'tiff',
  'application/zip': 'zip',
}

/**
 * The file extension for a rendered part's MIME type, `bin` when unknown.
 *
 * Pass the produced type (see {@link producedMimeType}), not a layer's
 * declared type, so a React part is named `.pdf` rather than `.bin`.
 */
export function getExtensionForMime(mimeType: string): string {
  return EXTENSION_BY_MIME[normalizeMimeType(mimeType)] ?? 'bin'
}

/**
 * A nested bundle's parts, named as a folder under the parent's content key.
 *
 * Rendering a bundle inside a bundle yields every part of the inner bundle, so
 * each keeps its own name under the key the parent gave the inner bundle:
 * `nested/docA` with the file `nested/docA.pdf`. Content keys cannot contain
 * `/`, so a nested name never collides with a sibling key. Deeper nesting
 * composes: the inner bundle has already named its own nested parts.
 *
 * @throws when the nested bundle rendered no parts, since the parent declared
 * content that produced nothing
 */
export function nestPartOutputs<T extends { filename: string }>(
  parentKey: string,
  outputs: Readonly<Record<string, T>>,
): Record<string, T> {
  const entries = Object.entries(outputs)
  if (entries.length === 0) {
    throw new Error(`Nested bundle "${parentKey}" rendered no parts`)
  }
  const nested: Record<string, T> = {}
  for (const [innerKey, output] of entries) {
    nested[`${parentKey}/${innerKey}`] = { ...output, filename: `${parentKey}/${output.filename}` }
  }
  return nested
}
