/**
 * Closure-based layer builders for artifacts.
 *
 * Uses factory functions and object literals instead of classes.
 * Replaces instanceof checks with duck typing via _isLayerBuilder property.
 */

import type { InlineLayer, FileLayer, Layer } from '@paradoc/types';

// ============================================================================
// Layer Builder Marker
// ============================================================================

/** Symbol to identify layer builders without instanceof */
const LAYER_BUILDER_MARKER = Symbol.for('paradoc.layer-builder');

/** Check if a value is a layer builder */
function isLayerBuilder(value: unknown): value is FileLayerBuilderType | InlineLayerBuilderType {
	return (
		typeof value === 'object' &&
		value !== null &&
		(value as { [LAYER_BUILDER_MARKER]?: boolean })[LAYER_BUILDER_MARKER] === true
	);
}

// ============================================================================
// Builder Types
// ============================================================================

export interface FileLayerBuilderType {
	readonly [LAYER_BUILDER_MARKER]: true;
	path(value: string): FileLayerBuilderType;
	mimeType(value: string): FileLayerBuilderType;
	title(value: string): FileLayerBuilderType;
	description(value: string): FileLayerBuilderType;
	checksum(value: string): FileLayerBuilderType;
	bindings(value: Record<string, string>): FileLayerBuilderType;
	bindingsFrom(value: string): FileLayerBuilderType;
	build(): FileLayer;
}

export interface InlineLayerBuilderType {
	readonly [LAYER_BUILDER_MARKER]: true;
	text(value: string): InlineLayerBuilderType;
	mimeType(value: string): InlineLayerBuilderType;
	title(value: string): InlineLayerBuilderType;
	description(value: string): InlineLayerBuilderType;
	bindings(value: Record<string, string>): InlineLayerBuilderType;
	bindingsFrom(value: string): InlineLayerBuilderType;
	build(): InlineLayer;
}

export interface LayerBuilderType {
	file(): FileLayerBuilderType;
	inline(): InlineLayerBuilderType;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a file-backed layer builder.
 *
 * @example
 * ```ts
 * const pdfLayer = fileLayer()
 *   .path('path/to/template.pdf')
 *   .mimeType('application/pdf')
 *   .title('PDF Version')
 *   .build()
 * ```
 */
export function fileLayer(): FileLayerBuilderType {
	const _def: Partial<FileLayer> & { kind: 'file' } = { kind: 'file' };

	const self: FileLayerBuilderType = {
		[LAYER_BUILDER_MARKER]: true as const,
		path(value: string) {
			_def.path = value;
			return self;
		},
		mimeType(value: string) {
			_def.mimeType = value;
			return self;
		},
		title(value: string) {
			_def.title = value;
			return self;
		},
		description(value: string) {
			_def.description = value;
			return self;
		},
		checksum(value: string) {
			_def.checksum = value;
			return self;
		},
		bindings(value: Record<string, string>) {
			_def.bindings = value;
			return self;
		},
		bindingsFrom(value: string) {
			_def.bindingsFrom = value;
			return self;
		},
		build(): FileLayer {
			if (!_def.path) {
				throw new Error('FileLayer requires a path. Use .path() to set it.');
			}
			if (!_def.mimeType) {
				throw new Error('FileLayer requires a mimeType. Use .mimeType() to set it.');
			}
			return _def as FileLayer;
		},
	};

	return self;
}

/**
 * Creates an inline layer builder with embedded text content.
 *
 * @example
 * ```ts
 * const textLayer = inlineLayer()
 *   .text('Hello {{name}}!')
 *   .mimeType('text/plain')
 *   .title('Greeting')
 *   .build()
 * ```
 */
export function inlineLayer(): InlineLayerBuilderType {
	const _def: Partial<InlineLayer> & { kind: 'inline' } = { kind: 'inline' };

	const self: InlineLayerBuilderType = {
		[LAYER_BUILDER_MARKER]: true as const,
		text(value: string) {
			_def.text = value;
			return self;
		},
		mimeType(value: string) {
			_def.mimeType = value;
			return self;
		},
		title(value: string) {
			_def.title = value;
			return self;
		},
		description(value: string) {
			_def.description = value;
			return self;
		},
		bindings(value: Record<string, string>) {
			_def.bindings = value;
			return self;
		},
		bindingsFrom(value: string) {
			_def.bindingsFrom = value;
			return self;
		},
		build(): InlineLayer {
			if (!_def.text) {
				throw new Error('InlineLayer requires text content. Use .text() to set it.');
			}
			if (!_def.mimeType) {
				throw new Error('InlineLayer requires a mimeType. Use .mimeType() to set it.');
			}
			return _def as InlineLayer;
		},
	};

	return self;
}

/**
 * Entry point builder that lets you choose the layer kind.
 *
 * @example
 * ```ts
 * // File-backed layer
 * layer().file().path('template.md').mimeType('text/markdown').build()
 *
 * // Inline layer
 * layer().inline().text('Hello!').mimeType('text/plain').build()
 * ```
 */
export function layerBuilder(): LayerBuilderType {
	return {
		file: fileLayer,
		inline: inlineLayer,
	};
}

// ============================================================================
// Layer API
// ============================================================================

export type LayerAPI = {
	/** Start building a layer - chain with .file() or .inline() */
	(): LayerBuilderType;
	/** Create a file layer directly */
	file(): FileLayerBuilderType;
	/** Create an inline layer directly */
	inline(): InlineLayerBuilderType;
	/** Check if a value is a layer builder */
	isBuilder(value: unknown): value is FileLayerBuilderType | InlineLayerBuilderType;
	/** Resolve a layer or builder to a Layer object */
	resolve(value: Layer | FileLayerBuilderType | InlineLayerBuilderType): Layer;
};

/**
 * Layer builder entry point.
 *
 * @example
 * ```ts
 * // Using layer() entry point
 * layer().file().path('template.pdf').mimeType('application/pdf').build()
 *
 * // Using direct factory
 * layer.file().path('template.pdf').mimeType('application/pdf').build()
 * layer.inline().text('Hello!').mimeType('text/plain').build()
 * ```
 */
export const layer: LayerAPI = Object.assign(layerBuilder, {
	file: fileLayer,
	inline: inlineLayer,
	isBuilder: isLayerBuilder,
	resolve: (value: Layer | FileLayerBuilderType | InlineLayerBuilderType): Layer => {
		if (isLayerBuilder(value)) {
			return value.build();
		}
		return value;
	},
});
