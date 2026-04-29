/**
 * Bbox serializer - validator and stringifier for geographic bounding boxes
 */

import type { Bbox } from '@paradoc/types'
import { isObject } from '../utils'

/**
 * Assert Bbox object is valid. Throws error if invalid.
 */
function assertBbox(value: unknown): void {
	if (!isObject(value)) {
		throw new TypeError('Invalid bbox: must be a Bbox object')
	}
	const bbox = value as Record<string, unknown>

	if (!('southWest' in bbox)) {
		throw new Error('Invalid bbox: missing required property "southWest"')
	}
	const sw = bbox.southWest
	if (!isObject(sw)) {
		throw new TypeError('Invalid bbox: "southWest" must be a Coordinate object')
	}
	if (!('lat' in sw) || !('lon' in sw)) {
		throw new Error('Invalid bbox: "southWest" must have "lat" and "lon" properties')
	}
	if (typeof sw.lat !== 'number' || typeof sw.lon !== 'number') {
		throw new TypeError('Invalid bbox: "southWest" must have numeric "lat" and "lon"')
	}
	if (!Number.isFinite(sw.lat) || sw.lat < -90 || sw.lat > 90) {
		throw new Error('Invalid bbox: "southWest.lat" must be between -90 and 90')
	}
	if (!Number.isFinite(sw.lon) || sw.lon < -180 || sw.lon > 180) {
		throw new Error('Invalid bbox: "southWest.lon" must be between -180 and 180')
	}

	if (!('northEast' in bbox)) {
		throw new Error('Invalid bbox: missing required property "northEast"')
	}
	const ne = bbox.northEast
	if (!isObject(ne)) {
		throw new TypeError('Invalid bbox: "northEast" must be a Coordinate object')
	}
	if (!('lat' in ne) || !('lon' in ne)) {
		throw new Error('Invalid bbox: "northEast" must have "lat" and "lon" properties')
	}
	if (typeof ne.lat !== 'number' || typeof ne.lon !== 'number') {
		throw new TypeError('Invalid bbox: "northEast" must have numeric "lat" and "lon"')
	}
	if (!Number.isFinite(ne.lat) || ne.lat < -90 || ne.lat > 90) {
		throw new Error('Invalid bbox: "northEast.lat" must be between -90 and 90')
	}
	if (!Number.isFinite(ne.lon) || ne.lon < -180 || ne.lon > 180) {
		throw new Error('Invalid bbox: "northEast.lon" must be between -180 and 180')
	}
}

/**
 * Bbox stringifier - reusable across all locales
 */
export const bboxStringifier = {
	stringify(value: Bbox | Partial<Bbox>, fallback = ''): string {
		if (value == null) return fallback

		assertBbox(value)

		const bbox = value as Bbox
		const sw = bbox.southWest
		const ne = bbox.northEast
		return `${sw.lat},${sw.lon},${ne.lat},${ne.lon}`
	},
}
