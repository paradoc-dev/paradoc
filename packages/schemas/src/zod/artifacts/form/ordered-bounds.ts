type ComparableBound = number | string

export interface OrderedBoundsIssue {
	path: [string]
	message: string
}

export function getOrderedBoundsIssue<T extends ComparableBound>(
	min: T | undefined,
	max: T | undefined,
	minField: string,
	maxField: string,
	isOrdered: (min: T, max: T) => boolean,
): OrderedBoundsIssue | undefined {
	if (min === undefined || max === undefined || isOrdered(min, max)) {
		return undefined
	}

	return {
		path: [maxField],
		message: `${maxField} must be greater than or equal to ${minField}`,
	}
}

export function compareTemporalBounds(min: string, max: string): boolean {
	const minTime = Date.parse(min)
	const maxTime = Date.parse(max)

	if (Number.isFinite(minTime) && Number.isFinite(maxTime)) {
		return minTime <= maxTime
	}

	return min <= max
}

/** Parse an ISO `HH:MM` or `HH:MM:SS[.fff]` time of day into seconds since midnight, or `undefined` if `value` doesn't match. */
function parseClockTimeSeconds(value: string): number | undefined {
	const match = /^(\d{2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/.exec(value)
	if (!match) return undefined
	const hours = Number(match[1])
	const minutes = Number(match[2])
	const seconds = match[3] !== undefined ? Number(match[3]) : 0
	if (![hours, minutes, seconds].every(Number.isFinite)) return undefined
	return hours * 3600 + minutes * 60 + seconds
}

export function compareClockTimeBounds(min: string, max: string): boolean {
	const minSeconds = parseClockTimeSeconds(min)
	const maxSeconds = parseClockTimeSeconds(max)

	if (minSeconds !== undefined && maxSeconds !== undefined) {
		return minSeconds <= maxSeconds
	}

	return min <= max
}
