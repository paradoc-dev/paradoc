import { describe, expect, test } from 'vitest'
import { REACT_LAYER_MIME_TYPES } from '@/rendering'
import { getExtensionForMime, producedMimeType } from '@/rendering/part-mime'

describe('naming a rendered bundle part', () => {
	test.each([
		['text/markdown', 'md'],
		['text/html', 'html'],
		['text/plain', 'txt'],
		['application/pdf', 'pdf'],
		['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
		['application/json', 'json'],
		['text/yaml', 'yaml'],
		['application/yaml', 'yaml'],
		['text/csv', 'csv'],
		['image/png', 'png'],
		['image/jpeg', 'jpg'],
		['image/gif', 'gif'],
		['image/tiff', 'tiff'],
		['application/zip', 'zip'],
	])('%s is named .%s', (mimeType, extension) => {
		expect(getExtensionForMime(mimeType)).toBe(extension)
	})

	test('a type is named whatever its case', () => {
		expect(getExtensionForMime('Application/PDF')).toBe('pdf')
		expect(getExtensionForMime('IMAGE/PNG')).toBe('png')
		expect(producedMimeType('Application/PDF')).toBe('application/pdf')
	})

	test('an unknown type falls back to .bin', () => {
		expect(getExtensionForMime('application/x-unknown')).toBe('bin')
		expect(getExtensionForMime('')).toBe('bin')
	})

	test('a React layer type has no extension of its own; its produced type does', () => {
		for (const mimeType of REACT_LAYER_MIME_TYPES) {
			expect(getExtensionForMime(mimeType)).toBe('bin')
			expect(producedMimeType(mimeType)).toBe('application/pdf')
			expect(getExtensionForMime(producedMimeType(mimeType))).toBe('pdf')
		}
	})

	test('any other layer produces its own type', () => {
		expect(producedMimeType('text/plain')).toBe('text/plain')
		expect(producedMimeType('application/pdf')).toBe('application/pdf')
		expect(producedMimeType('application/x-unknown')).toBe('application/x-unknown')
	})
})
