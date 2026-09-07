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

export function compareClockTimeBounds(min: string, max: string): boolean {
	const parseTime = (value: string): number | undefined => {
		const [hours, minutes, seconds] = value.split(':').map(Number)
		if (
			hours === undefined ||
			minutes === undefined ||
			seconds === undefined ||
			![hours, minutes, seconds].every(Number.isFinite)
		) {
			return undefined
		}
		return hours * 3600 + minutes * 60 + seconds
	}

	const minSeconds = parseTime(min)
	const maxSeconds = parseTime(max)

	if (minSeconds !== undefined && maxSeconds !== undefined) {
		return minSeconds <= maxSeconds
	}

	return min <= max
}
