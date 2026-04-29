/**
 * Coordinate serializer - validator and stringifier for geographic coordinates
 */

import type { Coordinate } from '@paradoc/types'
import { isObject } from '../utils'

/**
 * Assert Coordinate object is valid. Throws error if invalid.
 */
function assertCoordinate(value: unknown): void {
	if (!isObject(value)) {
		throw new TypeError('Invalid coordinate: must be a Coordinate object')
	}
	const coord = value as Record<string, unknown>

	if (!('lat' in coord)) {
		throw new Error('Invalid coordinate: missing required property "lat"')
	}
	if (typeof coord.lat !== 'number') {
		throw new TypeError(`Invalid coordinate: "lat" must be a number, got ${typeof coord.lat}`)
	}
	if (!Number.isFinite(coord.lat) || coord.lat < -90 || coord.lat > 90) {
		throw new Error('Invalid coordinate: "lat" must be a finite number between -90 and 90')
	}

	if (!('lon' in coord)) {
		throw new Error('Invalid coordinate: missing required property "lon"')
	}
	if (typeof coord.lon !== 'number') {
		throw new TypeError(`Invalid coordinate: "lon" must be a number, got ${typeof coord.lon}`)
	}
	if (!Number.isFinite(coord.lon) || coord.lon < -180 || coord.lon > 180) {
		throw new Error('Invalid coordinate: "lon" must be a finite number between -180 and 180')
	}
}

/**
 * Coordinate stringifier - reusable across all locales
 */
export const coordinateStringifier = {
	stringify(value: Coordinate | Partial<Coordinate>, fallback = ''): string {
		if (value == null) return fallback

		assertCoordinate(value)

		const coord = value as Coordinate
		return `${coord.lat},${coord.lon}`
	},
}
