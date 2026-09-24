/**
 * Compare a `date`, `date-time`, or `time` string against a bound of the same
 * format as a value, not lexically. A `date-time` bound must accept a value
 * that falls chronologically within it regardless of UTC offset or
 * fractional-second precision; a `time` bound must accept a value regardless
 * of whether seconds or a fraction are present. `date` values are already
 * fixed-width and sort correctly as strings.
 */

/** Parse an ISO `HH:MM` or `HH:MM:SS[.fff]` time of day into seconds since midnight, or `undefined` if it doesn't match. */
function parseClockTimeSeconds(value: string): number | undefined {
	const match = /^(\d{2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/.exec(value)
	if (!match) return undefined
	const hours = Number(match[1])
	const minutes = Number(match[2])
	const seconds = match[3] !== undefined ? Number(match[3]) : 0
	if (![hours, minutes, seconds].every(Number.isFinite)) return undefined
	return hours * 3600 + minutes * 60 + seconds
}

/** `-1` if `value` orders before `bound`, `1` if after, `0` if equal or if neither side parses for `format`. */
export function compareFormattedTemporal(format: 'date' | 'date-time' | 'time', value: string, bound: string): number {
	if (format === 'date-time') {
		const valueMs = Date.parse(value)
		const boundMs = Date.parse(bound)
		if (Number.isFinite(valueMs) && Number.isFinite(boundMs)) {
			return valueMs < boundMs ? -1 : valueMs > boundMs ? 1 : 0
		}
	} else if (format === 'time') {
		const valueSeconds = parseClockTimeSeconds(value)
		const boundSeconds = parseClockTimeSeconds(bound)
		if (valueSeconds !== undefined && boundSeconds !== undefined) {
			return valueSeconds < boundSeconds ? -1 : valueSeconds > boundSeconds ? 1 : 0
		}
	}
	return value < bound ? -1 : value > bound ? 1 : 0
}
