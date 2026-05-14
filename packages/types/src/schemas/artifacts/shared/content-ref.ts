/**
 * Content reference types for artifact instructions
 */

/**
 * Inline content reference — text embedded directly.
 */
export interface InlineContentRef {
  /** Discriminator for inline content. */
  kind: "inline";
  /** Inline text content. */
  text: string;
}

/**
 * File content reference — references an external file by path.
 */
export interface FileContentRef {
  /** Discriminator for file content. */
  kind: "file";
  /** Path to the content file. */
  path: string;
  /** MIME type of the file content. */
  mimeType: string;
  /** Optional human-readable title. */
  title?: string;
  /** Optional description of the content. */
  description?: string;
  /** Optional SHA-256 checksum for integrity verification. */
  checksum?: string;
}

/**
 * Content reference — inline text or external file.
 * Used for instructions and agent instructions on artifacts.
 */
export type ContentRef = InlineContentRef | FileContentRef;
