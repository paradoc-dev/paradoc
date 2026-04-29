/**
 * Datetime primitive builder with ISO 8601 datetime format validation
 */

// ISO 8601 datetime format regex (supports both Z and +/-HH:MM timezone)
const DATETIME_REGEX =
	/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/;

function isValidDatetime(value: string): boolean {
	if (!DATETIME_REGEX.test(value)) {
		return false;
	}
	// Additional validation: check if the datetime is actually valid
	const date = new Date(value);
	return !isNaN(date.getTime());
}

function parse(input: unknown): string {
	if (typeof input !== 'string') {
		throw new Error(`Invalid Datetime: expected string, got ${typeof input}`);
	}
	if (!isValidDatetime(input)) {
		throw new Error(
			`Invalid Datetime: "${input}" is not a valid ISO 8601 datetime`,
		);
	}
	return input;
}

type DatetimeAPI = {
	(input: string): string;
	parse(input: unknown): string;
	safeParse(
		input: unknown,
	): { success: true; data: string } | { success: false; error: Error };
	isValid(input: string): boolean;
	/** Create a datetime string from a Date object */
	fromDate(date: Date): string;
	/** Get current datetime as ISO string */
	now(): string;
};

function datetimeImpl(input: string): string {
	return parse(input);
}

export const datetime: DatetimeAPI = Object.assign(datetimeImpl, {
	parse,
	safeParse: (
		input: unknown,
	): { success: true; data: string } | { success: false; error: Error } => {
		try {
			return { success: true, data: parse(input) };
		} catch (err) {
			return { success: false, error: err as Error };
		}
	},
	isValid: (input: string): boolean => {
		return isValidDatetime(input);
	},
	fromDate: (date: Date): string => {
		return date.toISOString();
	},
	now: (): string => {
		return new Date().toISOString();
	},
});
