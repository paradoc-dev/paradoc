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
  return isReactLayerMimeType(layerMimeType) ? 'application/pdf' : layerMimeType
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
}

/**
 * The file extension for a rendered part's MIME type, `bin` when unknown.
 *
 * Pass the produced type (see {@link producedMimeType}), not a layer's
 * declared type, so a React part is named `.pdf` rather than `.bin`.
 */
export function getExtensionForMime(mimeType: string): string {
  return EXTENSION_BY_MIME[mimeType] ?? 'bin'
}
