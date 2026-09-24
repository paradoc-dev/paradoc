/**
 * Layer types for artifact rendering
 */

/**
 * Field type for a signature slot. Mirrors SigningFieldType.
 */
export type SignatureSlotType = 'signature' | 'initials' | 'date_signed' | 'capacity' | 'printed_name';

/**
 * Where a signature slot lands in the sealed PDF.
 * - 'flow': the field sits where the template content places it — the render
 *   stage injects an invisible marker at the slot's placeholder and the
 *   placement stage locates it after conversion.
 * - absolute: fixed coordinates known at design time (PDF templates).
 * - anchor: found by literal document text after conversion; text must be
 *   unique unless `occurrence` picks a match (1-based, reading order).
 */
export type SignatureSlotPlacement =
  | 'flow'
  | { page: number; x: number; y: number; width: number; height: number }
  | {
      anchor: { text: string; offsetX?: number; offsetY?: number; occurrence?: number };
      width: number;
      height: number;
    };

/**
 * Signature slot: one signing field on a layer, keyed by slot id.
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
 * MIME types that name a React composition module.
 *
 * A composition is a React component in a `.tsx` or `.jsx` file. The layer that
 * declares one is a pointer to that module, so it is always a `FileLayer`: an
 * `InlineLayer` carrying one of these types is rejected at validation. Nothing
 * reads the file as content; the module is bound at render time.
 */
export type ReactLayerMimeType = 'text/tsx' | 'text/jsx';

/**
 * Inline layer with embedded text content.
 * Used for layers where content is stored directly in the artifact definition.
 */
export interface InlineLayer {
  /** Discriminator for inline layer type. */
  kind: "inline";
  /**
   * MIME type of the content (e.g., text/markdown, text/html).
   * Never a {@link ReactLayerMimeType}: a React layer names a module and must
   * be a {@link FileLayer}.
   */
  mimeType: string;
  /** Layer content with interpolation placeholders, such as `{{fields.fieldName}}`. */
  text: string;
  /** Optional human-readable title for this layer. */
  title?: string;
  /** Optional description of what this layer represents. */
  description?: string;
  /** Signature slots keyed by slot id. */
  signatures?: Record<string, SignatureSlot>;
}

/**
 * A font a PDF layer draws filled values and overlay text with.
 *
 * The font file is read through the same resolver as the layer's PDF, so it
 * travels with the artifact the same way. It must be a TrueType-outline font
 * program (.ttf).
 */
export interface LayerFont {
  /** Logical path passed unchanged to the bound resolver, like the layer's own path. */
  path: string;
  /** Optional SHA-256 checksum for integrity verification. */
  checksum?: string;
}

/**
 * How a PDF layer presents money values its template already frames.
 *
 * Only the currency display is declared here. Locale, digits, and every other
 * choice stay with the formatter the caller renders with.
 */
export interface LayerMoneyFormat {
  /**
   * `none` prints the amount without a currency symbol or code, for a template
   * that pre-prints the symbol beside each money box.
   */
  currencyDisplay: "none";
}

/**
 * Presentation a PDF layer's template requires of filled values, applied over
 * the formatter the caller renders with.
 */
export interface LayerFormat {
  /** How money values are presented in this layer. */
  money?: LayerMoneyFormat;
}

/**
 * File-backed layer with external file reference.
 * Used for layers where content is stored in a separate file.
 */
export interface FileLayer {
  /** Discriminator for file layer type. */
  kind: "file";
  /**
   * MIME type of the file (e.g., application/pdf). A
   * {@link ReactLayerMimeType} declares a React composition.
   */
  mimeType: string;
  /**
   * Logical path passed unchanged to the bound resolver. The CLI resolves paths
   * from a file-backed artifact's directory, or from cwd for stdin artifacts;
   * custom resolvers define their own semantics.
   *
   * For a React layer it is a pointer to the composition module, never read as
   * content. Binding that module by import executes it, so a renderer that does
   * so confines the path to the artifact's own directory.
   */
  path: string;
  /** Optional human-readable title for this layer. */
  title?: string;
  /** Optional description of what this layer represents. */
  description?: string;
  /** Optional SHA-256 checksum for integrity verification. */
  checksum?: string;
  /**
   * Font for filled values and overlay text. PDF layers only. It is tried
   * after a font supplied at render time and before the form's own fonts.
   */
  font?: LayerFont;
  /**
   * Presentation the layer's template requires of filled values. PDF layers
   * only. It applies to this layer alone; a layer that reuses these bindings
   * through `bindingsFrom` declares its own.
   */
  format?: LayerFormat;
  /**
   * PDF layers only. Maps each AcroForm field name in the template (key) to
   * the Paradoc path that fills it (value), such as `fields.name`.
   */
  bindings?: Bindings;
  /** PDF layers only. Key of a sibling PDF layer whose bindings this layer reuses. */
  bindingsFrom?: string;
  /** Signature slots keyed by slot id. */
  signatures?: Record<string, SignatureSlot>;
}

/**
 * Layer specification - one of inline or file.
 * Layers are named renderings of content artifacts into specific formats.
 */
export type Layer = InlineLayer | FileLayer;

/**
 * A PDF layer's bindings: each key is a fully qualified AcroForm field name in
 * the template, and each value is the Paradoc path that fills it.
 */
export type Bindings = Record<string, string>;
