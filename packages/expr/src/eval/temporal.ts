/**
 * Temporal helpers. Temporal values are ISO strings at runtime; these helpers
 * parse them for the date functions. Calendar arithmetic uses UTC `Date` (which
 * is deterministic and integer-based) without ever reading the wall clock.
 */

import { EvaluationError } from './errors'

const MS_PER_DAY = 86_400_000

function parse(s: string): Date {
	const d = new Date(s)
	if (Number.isNaN(d.getTime())) {
		throw new EvaluationError('type-error', `Invalid date: ${JSON.stringify(s)}`)
	}
	return d
}

/** Format a Date as an ISO `YYYY-MM-DD` (UTC). */
export function formatDate(d: Date): string {
	return d.toISOString().slice(0, 10)
}

/** Whole days from `a` to `b` (b - a), truncated toward zero. */
export function diffDays(a: string, b: string): number {
	return Math.trunc((parse(b).getTime() - parse(a).getTime()) / MS_PER_DAY)
}

/** Full calendar years from `from` to `to` (floored). */
export function yearsBetween(from: string, to: string): number {
	const a = parse(from)
	const b = parse(to)
	let years = b.getUTCFullYear() - a.getUTCFullYear()
	const beforeAnniversary =
		b.getUTCMonth() < a.getUTCMonth() ||
		(b.getUTCMonth() === a.getUTCMonth() && b.getUTCDate() < a.getUTCDate())
	if (beforeAnniversary) years--
	return years
}

/** Difference between two dates in the given unit (`days` default). */
export function dateDiff(from: string, to: string, unit = 'days'): number {
	switch (unit) {
		case 'days':
			return diffDays(from, to)
		case 'years':
			return yearsBetween(from, to)
		case 'months': {
			const a = parse(from)
			const b = parse(to)
			let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth())
			if (b.getUTCDate() < a.getUTCDate()) months--
			return months
		}
		default:
			throw new EvaluationError('type-error', `Unknown date unit: ${JSON.stringify(unit)}`)
	}
}

/** Add a whole number of days to a date, returning an ISO `YYYY-MM-DD`. */
export function addDays(date: string, days: number): string {
	const d = parse(date)
	d.setUTCDate(d.getUTCDate() + Math.trunc(days))
	return formatDate(d)
}

const DURATION_RE = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/

/** Add an ISO 8601 duration (date components only, e.g. `P1Y2M10D`) to a date. */
export function addDuration(date: string, duration: string): string {
	const m = DURATION_RE.exec(duration)
	if (!m || duration === 'P') {
		throw new EvaluationError('type-error', `Invalid duration: ${JSON.stringify(duration)}`)
	}
	const [, y, mo, w, d] = m
	const result = parse(date)
	if (y) result.setUTCFullYear(result.getUTCFullYear() + Number(y))
	if (mo) result.setUTCMonth(result.getUTCMonth() + Number(mo))
	const days = (w ? Number(w) * 7 : 0) + (d ? Number(d) : 0)
	if (days) result.setUTCDate(result.getUTCDate() + days)
	return formatDate(result)
}
