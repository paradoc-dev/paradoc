/**
 * Duration serializer - validator and stringifier for ISO 8601 durations
 */

import type { Duration } from '@paradoc/types'

/**
 * ISO 8601 duration regex pattern
 * Matches: P[n]Y[n]M[n]W[n]DT[n]H[n]M[n]S
 */
const ISO_DURATION_REGEX = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/

interface ParsedDuration {
	years: number
	months: number
	weeks: number
	days: number
	hours: number
	minutes: number
	seconds: number
}

/**
 * Parse an ISO 8601 duration string into components.
 */
function parseDuration(value: string): ParsedDuration {
	const match = value.match(ISO_DURATION_REGEX)
	if (!match) {
		throw new Error(`Invalid ISO 8601 duration format: ${value}`)
	}

	return {
		years: parseInt(match[1] || '0', 10),
		months: parseInt(match[2] || '0', 10),
		weeks: parseInt(match[3] || '0', 10),
		days: parseInt(match[4] || '0', 10),
		hours: parseInt(match[5] || '0', 10),
		minutes: parseInt(match[6] || '0', 10),
		seconds: parseFloat(match[7] || '0'),
	}
}

/**
 * Format a number with singular/plural unit label.
 */
function formatUnit(value: number, singular: string, plural: string): string | null {
	if (value === 0) return null
	return value === 1 ? `${value} ${singular}` : `${value} ${plural}`
}

/**
 * Convert parsed duration to human-readable string.
 */
function formatDuration(parsed: ParsedDuration): string {
	const parts: string[] = []

	const yearPart = formatUnit(parsed.years, 'year', 'years')
	if (yearPart) parts.push(yearPart)

	const monthPart = formatUnit(parsed.months, 'month', 'months')
	if (monthPart) parts.push(monthPart)

	const weekPart = formatUnit(parsed.weeks, 'week', 'weeks')
	if (weekPart) parts.push(weekPart)

	const dayPart = formatUnit(parsed.days, 'day', 'days')
	if (dayPart) parts.push(dayPart)

	const hourPart = formatUnit(parsed.hours, 'hour', 'hours')
	if (hourPart) parts.push(hourPart)

	const minutePart = formatUnit(parsed.minutes, 'minute', 'minutes')
	if (minutePart) parts.push(minutePart)

	if (parsed.seconds !== 0) {
		// Handle decimal seconds
		const secondsStr = Number.isInteger(parsed.seconds)
			? parsed.seconds.toString()
			: parsed.seconds.toFixed(2).replace(/\.?0+$/, '')
		parts.push(parsed.seconds === 1 ? `${secondsStr} second` : `${secondsStr} seconds`)
	}

	if (parts.length === 0) {
		return '0 seconds'
	}

	return parts.join(', ')
}

/**
 * Assert Duration string is valid. Throws error if invalid.
 * ISO 8601 duration format: P[n]Y[n]M[n]W[n]DT[n]H[n]M[n]S
 */
function assertDuration(value: unknown): void {
	if (typeof value !== 'string') {
		throw new TypeError(`Invalid duration: must be a string, got ${typeof value}`)
	}
	if (value === '') {
		throw new Error('Invalid duration: cannot be empty')
	}
	// Basic ISO 8601 format check
	if (!value.startsWith('P')) {
		throw new Error('Invalid duration: must start with "P" (e.g., "P1Y", "PT30M", "P1DT12H")')
	}
	// Validate full format
	if (!ISO_DURATION_REGEX.test(value)) {
		throw new Error(`Invalid ISO 8601 duration format: ${value}`)
	}
}

/**
 * Duration stringifier - reusable across all locales
 * Converts ISO 8601 duration strings to human-readable format.
 *
 * @example
 * stringify("P1Y") // "1 year"
 * stringify("P2M3D") // "2 months, 3 days"
 * stringify("PT1H30M") // "1 hour, 30 minutes"
 * stringify("P1Y2M3DT4H5M6S") // "1 year, 2 months, 3 days, 4 hours, 5 minutes, 6 seconds"
 */
export const durationStringifier = {
	stringify(value: Duration | string, fallback = ''): string {
		if (value == null) return fallback

		assertDuration(value)

		const parsed = parseDuration(value as string)
		return formatDuration(parsed)
	},
}
