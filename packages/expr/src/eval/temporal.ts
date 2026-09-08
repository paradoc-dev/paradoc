/**
 * Temporal helpers. Temporal values are ISO strings at runtime; these helpers
 * parse them for the date functions. Calendar arithmetic uses UTC `Date` (which
 * is deterministic and integer-based) without ever reading the wall clock.
 */

import { EvaluationError } from './errors'

const MS_PER_DAY = 86_400_000

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function parse(s: string): Date {
	const match = DATE_RE.exec(s)
	if (!match) throw new EvaluationError('type-error', `Expected a canonical date (YYYY-MM-DD), got ${JSON.stringify(s)}`)
	const d = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
	if (formatDate(d) !== s) throw new EvaluationError('type-error', `Invalid date: ${JSON.stringify(s)}`)
	return d
}

export function validateDate(s: string): string {
	parse(s)
	return s
}

export function validateDateDuration(s: string): string {
	if (!DURATION_RE.test(s) || s === 'P') throw new EvaluationError('type-error', `Invalid duration: ${JSON.stringify(s)}`)
	return s
}

export function validateDatetime(s: string): string {
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|([+-])(\d{2}):(\d{2}))$/.exec(s)
	if (!match) {
		throw new EvaluationError('type-error', `Expected a canonical datetime with an explicit offset, got ${JSON.stringify(s)}`)
	}
	const [, year, month, day, hour, minute, second = '0', fraction = '0', , sign, offsetHour = '0', offsetMinute = '0'] = match
	const values = [year, month, day, hour, minute, second].map(Number)
	const [y, mo, d, h, mi, sec] = values
	if (h! > 23 || mi! > 59 || sec! > 59 || Number(offsetHour) > 23 || Number(offsetMinute) > 59) {
		throw new EvaluationError('type-error', `Invalid datetime: ${JSON.stringify(s)}`)
	}
	const offset = (Number(offsetHour) * 60 + Number(offsetMinute)) * (sign === '-' ? -1 : 1)
	const expected = Date.UTC(y!, mo! - 1, d!, h!, mi!, sec!, Number(fraction.padEnd(3, '0'))) - offset * 60_000
	const calendar = new Date(Date.UTC(y!, mo! - 1, d!))
	if (calendar.getUTCFullYear() !== y || calendar.getUTCMonth() !== mo! - 1 || calendar.getUTCDate() !== d || Date.parse(s) !== expected) {
		throw new EvaluationError('type-error', `Invalid datetime: ${JSON.stringify(s)}`)
	}
	return s
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
	const original = parse(date)
	const targetYear = original.getUTCFullYear() + Number(y ?? 0)
	const targetMonth = original.getUTCMonth() + Number(mo ?? 0)
	const targetDay = original.getUTCDate()
	const result = new Date(Date.UTC(targetYear, targetMonth, 1))
	const finalDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
	result.setUTCDate(Math.min(targetDay, finalDay))
	const days = (w ? Number(w) * 7 : 0) + (d ? Number(d) : 0)
	if (days) result.setUTCDate(result.getUTCDate() + days)
	return formatDate(result)
}
