import { describe, it, expect } from 'vitest';
import { layer } from '@/artifacts';

describe('Layer', () => {
	// ============================================================================
	// Builder Pattern Tests
	// ============================================================================

	describe('Builder Pattern', () => {
		describe('layer()', () => {
			it('returns a LayerBuilder when called', () => {
				const builder = layer();
				expect(typeof builder.file).toBe('function');
				expect(typeof builder.inline).toBe('function');
			});
		});

		describe('file layer', () => {
			it('creates a file layer via layer().file()', () => {
				const result = layer()
					.file()
					.path('/path/to/file.pdf')
					.mimeType('application/pdf')
					.build();

				expect(result).toEqual({
					kind: 'file',
					path: '/path/to/file.pdf',
					mimeType: 'application/pdf',
				});
			});

			it('creates a file layer via layer.file()', () => {
				const result = layer
					.file()
					.path('/path/to/file.pdf')
					.mimeType('application/pdf')
					.build();

				expect(result).toEqual({
					kind: 'file',
					path: '/path/to/file.pdf',
					mimeType: 'application/pdf',
				});
			});

			it('supports optional properties', () => {
				const result = layer()
					.file()
					.path('/path/to/template.md')
					.mimeType('text/markdown')
					.title('Template')
					.description('A markdown template')
					.checksum('abc123')
					.build();

				expect(result).toEqual({
					kind: 'file',
					path: '/path/to/template.md',
					mimeType: 'text/markdown',
					title: 'Template',
					description: 'A markdown template',
					checksum: 'abc123',
				});
			});

			it('binds AcroForm field names to Paradoc paths on a PDF layer', () => {
				const bound = layer()
					.file()
					.path('w-9.pdf')
					.mimeType('application/pdf')
					.bindings({ 'topmostSubform[0].Page1[0].f1_01[0]': 'fields.name' })
					.build();
				expect(bound.bindings).toEqual({ 'topmostSubform[0].Page1[0].f1_01[0]': 'fields.name' });

				const reused = layer().file().path('w-9-b.pdf').mimeType('application/pdf').bindingsFrom('copyA').build();
				expect(reused.bindingsFrom).toBe('copyA');
			});

			it('refuses bindings or bindingsFrom on a layer that is not a PDF', () => {
				const markdown = () => layer().file().path('notice.md').mimeType('text/markdown');
				expect(() => markdown().bindings({ name: 'fields.name' }).build()).toThrow('Only PDF layers (application/pdf) can declare bindings');
				expect(() => markdown().bindingsFrom('copyA').build()).toThrow('Only PDF layers (application/pdf) can declare bindings');
			});

			it('throws when path is missing', () => {
				expect(() => {
					layer().file().mimeType('application/pdf').build();
				}).toThrow('FileLayer requires a path');
			});

			it('throws when mimeType is missing', () => {
				expect(() => {
					layer().file().path('/path/to/file.pdf').build();
				}).toThrow('FileLayer requires a mimeType');
			});
		});

		describe('inline layer', () => {
			it('creates an inline layer via layer().inline()', () => {
				const result = layer()
					.inline()
					.text('Hello {{fields.name}}!')
					.mimeType('text/plain')
					.build();

				expect(result).toEqual({
					kind: 'inline',
					text: 'Hello {{fields.name}}!',
					mimeType: 'text/plain',
				});
			});

			it('creates an inline layer via layer.inline()', () => {
				const result = layer
					.inline()
					.text('Hello {{fields.name}}!')
					.mimeType('text/plain')
					.build();

				expect(result).toEqual({
					kind: 'inline',
					text: 'Hello {{fields.name}}!',
					mimeType: 'text/plain',
				});
			});

			it('supports optional properties', () => {
				const result = layer()
					.inline()
					.text('Hello {{fields.name}}!')
					.mimeType('text/plain')
					.title('Greeting')
					.description('A greeting template')
					.build();

				expect(result).toEqual({
					kind: 'inline',
					text: 'Hello {{fields.name}}!',
					mimeType: 'text/plain',
					title: 'Greeting',
					description: 'A greeting template',
				});
			});

			it('offers no bindings: an inline template names values as {{fields.x}}', () => {
				const builder = layer().inline();
				expect('bindings' in builder).toBe(false);
				expect('bindingsFrom' in builder).toBe(false);
			});

			it('throws when text is missing', () => {
				expect(() => {
					layer().inline().mimeType('text/plain').build();
				}).toThrow('InlineLayer requires text content');
			});

			it('throws when mimeType is missing', () => {
				expect(() => {
					layer().inline().text('Hello!').build();
				}).toThrow('InlineLayer requires a mimeType');
			});
		});

		describe('layer.isBuilder()', () => {
			it('returns true for FileLayerBuilder', () => {
				const builder = layer.file();
				expect(layer.isBuilder(builder)).toBe(true);
			});

			it('returns true for InlineLayerBuilder', () => {
				const builder = layer.inline();
				expect(layer.isBuilder(builder)).toBe(true);
			});

			it('returns false for plain objects', () => {
				const obj = { kind: 'file', path: '/path', mimeType: 'text/plain' };
				expect(layer.isBuilder(obj)).toBe(false);
			});

			it('returns false for null/undefined', () => {
				expect(layer.isBuilder(null)).toBe(false);
				expect(layer.isBuilder(undefined)).toBe(false);
			});
		});

		describe('layer.resolve()', () => {
			it('resolves FileLayerBuilder to Layer', () => {
				const builder = layer
					.file()
					.path('/path/to/file.pdf')
					.mimeType('application/pdf');
				const result = layer.resolve(builder);

				expect(result).toEqual({
					kind: 'file',
					path: '/path/to/file.pdf',
					mimeType: 'application/pdf',
				});
			});

			it('resolves InlineLayerBuilder to Layer', () => {
				const builder = layer.inline().text('Hello!').mimeType('text/plain');
				const result = layer.resolve(builder);

				expect(result).toEqual({
					kind: 'inline',
					text: 'Hello!',
					mimeType: 'text/plain',
				});
			});

			it('passes through plain Layer objects unchanged', () => {
				const layerObj = {
					kind: 'file' as const,
					path: '/path',
					mimeType: 'text/plain',
				};
				const result = layer.resolve(layerObj);

				expect(result).toBe(layerObj); // Same reference
			});
		});
	});
});
