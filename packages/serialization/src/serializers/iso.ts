/**
 * Shared ISO 8601 parsing for the date and datetime serializers.
 *
 * Calendar components are read directly from the written digits, never from
 * `Date`'s own string parsing. `new Date(string)` normalizes every value to a
 * single UTC instant, which breaks in two directions: an offset-bearing value
 * gets reformatted in the wrong calendar day once displayed in UTC (
 * `2026-09-04T23:30:00-05:00` is `2026-09-05T04:30:00Z`, a whole day later),
 * and an offsetless value is parsed in the *host's* local time zone, so the
 * same string prints a different day depending on the machine running it.
 *
 * Reading the written digits directly and rendering them with
 * `timeZone: "UTC"` sidesteps both problems at once: whatever offset the
 * value carries (or its absence, always treated as UTC, never host-local) is
 * exactly the frame the calendar day and clock time are read in, and the
 * host machine's own time zone never enters the calculation.
 */

/** The calendar and clock components an ISO 8601 string names, read verbatim. */
export interface IsoParts {
  year: number;
  /** 1-12. */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/;

/**
 * Parse an ISO 8601 date or datetime string's written digits, ignoring any
 * trailing offset. Returns `undefined` when the string matches neither shape.
 */
export function parseIsoParts(value: string): IsoParts | undefined {
  const dateOnly = DATE_ONLY.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return { year: Number(year), month: Number(month), day: Number(day), hour: 0, minute: 0, second: 0 };
  }

  const datetime = DATETIME.exec(value);
  if (datetime) {
    const [, year, month, day, hour, minute, second] = datetime;
    return {
      year: Number(year),
      month: Number(month),
      day: Number(day),
      hour: Number(hour),
      minute: Number(minute),
      second: Number(second ?? 0),
    };
  }

  return undefined;
}

/** Whether the parsed parts name a real calendar date and time (rejects, e.g., Feb 30 or a leap day outside a leap year). */
export function isValidCalendarDate(parts: IsoParts): boolean {
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const check = new Date(asUtc);
  return (
    check.getUTCFullYear() === parts.year &&
    check.getUTCMonth() === parts.month - 1 &&
    check.getUTCDate() === parts.day &&
    check.getUTCHours() === parts.hour &&
    check.getUTCMinutes() === parts.minute &&
    check.getUTCSeconds() === parts.second
  );
}

/**
 * Build a `Date` whose UTC getters return exactly the parsed wall-clock
 * components. Formatting this `Date` with `timeZone: "UTC"` reproduces the
 * value's own written digits, regardless of the offset (or its absence) the
 * source string carried.
 */
export function toUtcDate(parts: IsoParts): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
}
