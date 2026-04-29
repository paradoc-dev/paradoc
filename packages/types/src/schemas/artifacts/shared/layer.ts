/**
 * Layer types for artifact rendering
 */

/**
 * Type of signature block field.
 * - 'signature': Full signature capture
 * - 'initials': Initials capture
 * - 'date': Date field for signing date
 */
export type SignatureBlockType = 'signature' | 'initials' | 'date';

/**
 * Pre-defined signature block for layers (typically PDF).
 * Used when signature positions are known at design time rather than
 * extracted from placeholder text at runtime.
 */
export interface SignatureBlock {
  /** Type of signature block. */
  type: SignatureBlockType;
  /** 1-based page number where this block appears. */
  page: number;
  /** X coordinate in points from left edge of page. */
  x: number;
  /** Y coordinate in points from top edge of page. */
  y: number;
  /** Width of the block in points. */
  width: number;
  /** Height of the block in points. */
  height: number;
  /** Party role this block is bound to (e.g., "taxpayer", "tenant"). */
  partyRole?: string;
  /** 0-based index for multi-party roles. Defaults to 0 (first party). */
  partyIndex?: number;
  /** Human-readable label for the block. */
  label?: string;
  /** Whether this block is required. Defaults to true. */
  required?: boolean;
}

/**
 * Inline layer with embedded text content.
 * Used for layers where content is stored directly in the artifact definition.
 */
export interface InlineLayer {
  /** Discriminator for inline layer type. */
  kind: "inline";
  /** MIME type of the content (e.g., text/markdown, text/html). */
  mimeType: string;
  /** Layer content with interpolation placeholders. */
  text: string;
  /** Optional human-readable title for this layer. */
  title?: string;
  /** Optional description of what this layer represents. */
  description?: string;
  /** Optional field bindings for the layer (typically for PDF). */
  bindings?: Record<string, string>;
  /** Key of a sibling layer whose bindings this layer reuses. */
  bindingsFrom?: string;
  /** Pre-defined signature blocks keyed by locationId. */
  signatureBlocks?: Record<string, SignatureBlock>;
}

/**
 * File-backed layer with external file reference.
 * Used for layers where content is stored in a separate file.
 */
export interface FileLayer {
  /** Discriminator for file layer type. */
  kind: "file";
  /** MIME type of the file (e.g., application/pdf). */
  mimeType: string;
  /** Absolute path from repo root to the layer file. */
  path: string;
  /** Optional human-readable title for this layer. */
  title?: string;
  /** Optional description of what this layer represents. */
  description?: string;
  /** Optional SHA-256 checksum for integrity verification. */
  checksum?: string;
  /** Optional field bindings for the layer (typically for PDF). */
  bindings?: Record<string, string>;
  /** Key of a sibling layer whose bindings this layer reuses. */
  bindingsFrom?: string;
  /** Pre-defined signature blocks keyed by locationId. */
  signatureBlocks?: Record<string, SignatureBlock>;
}

/**
 * Layer specification - one of inline or file.
 * Layers are named renderings of content artifacts into specific formats.
 */
export type Layer = InlineLayer | FileLayer;

/**
 * Mapping from form field names to layer target identifiers.
 * Used to bind form fields to PDF form fields or other layer targets.
 */
export type Bindings = Record<string, string>;
