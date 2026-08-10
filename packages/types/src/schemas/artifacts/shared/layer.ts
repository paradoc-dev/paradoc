/**
 * Layer types for artifact rendering
 */

/**
 * Type of signature block field.
 * - 'signature': Full signature capture (glyph)
 * - 'initials': Initials capture (glyph)
 * - 'date': Date field for signing date
 * - 'capacity': Signer's role/title (e.g., "President", "Trustee", "Attorney-in-fact")
 * - 'printed_name': Typed-out name accompanying the signature
 */
export type SignatureBlockType = 'signature' | 'initials' | 'date' | 'capacity' | 'printed_name';

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
 * Anchor block for layers where signature position is derived from text in the document.
 * Used when exact coordinates are unknown at design time. The Sealer adapter locates
 * the anchor text in the rendered document and resolves the final position.
 *
 * Coordinates use PDF standard: points from origin, where 1 point = 1/72 inch.
 */
export interface AnchorBlock {
  /** Type of signature field to place at the anchor location. */
  type: SignatureBlockType;
  /** Text anchor identifying where to place this field in the document. */
  anchor: {
    /** Text string to search for in the rendered document. */
    text: string;
    /** Horizontal offset in points from the left of the found text. */
    offsetX: number;
    /** Vertical offset in points from the top of the found text. */
    offsetY: number;
  };
  /** Width of the field in points. */
  width: number;
  /** Height of the field in points. */
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
 * Field type for a unified signature slot. Mirrors SigningFieldType: unlike
 * the legacy SignatureBlockType, the signing date is 'date_signed'.
 */
export type SignatureSlotType = 'signature' | 'initials' | 'date_signed' | 'capacity' | 'printed_name';

/**
 * Where a signature slot lands in the sealed PDF.
 * - 'auto': the render stage injects an invisible marker at the slot's
 *   placeholder; the placement stage locates it after conversion.
 * - absolute: fixed coordinates known at design time (PDF templates).
 * - anchor: found by literal document text after conversion; text must be
 *   unique unless `occurrence` picks a match (1-based, reading order).
 */
export type SignatureSlotPlacement =
  | 'auto'
  | { page: number; x: number; y: number; width: number; height: number }
  | {
      anchor: { text: string; offsetX?: number; offsetY?: number; occurrence?: number };
      width: number;
      height: number;
    };

/**
 * Unified signature slot: one signing field on a layer, keyed by slot id.
 * Supersedes signatureBlocks/anchorBlocks, which remain readable during the
 * deprecation window.
 */
export interface SignatureSlot {
  /** Party this slot binds to. index is 0-based for multi-party roles (default 0). */
  party: { role: string; index?: number };
  /** Type of signing field. */
  type: SignatureSlotType;
  /** Whether the slot must be signed. Defaults to true. */
  required?: boolean;
  /** Human-readable label. */
  label?: string;
  /** Placement specification. */
  placement: SignatureSlotPlacement;
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
  /** Pre-defined signature blocks keyed by locationId (coordinate-based). */
  signatureBlocks?: Record<string, SignatureBlock>;
  /** Anchor-based signature blocks keyed by locationId. Position is resolved from anchor text by the Sealer adapter. */
  anchorBlocks?: Record<string, AnchorBlock>;
  /** Unified signature slots keyed by slot id. Supersedes signatureBlocks/anchorBlocks. */
  signatures?: Record<string, SignatureSlot>;
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
  /** Pre-defined signature blocks keyed by locationId (coordinate-based). */
  signatureBlocks?: Record<string, SignatureBlock>;
  /** Anchor-based signature blocks keyed by locationId. Position is resolved from anchor text by the Sealer adapter. */
  anchorBlocks?: Record<string, AnchorBlock>;
  /** Unified signature slots keyed by slot id. Supersedes signatureBlocks/anchorBlocks. */
  signatures?: Record<string, SignatureSlot>;
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
