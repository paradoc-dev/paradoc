/**
 * Date primitive builder with ISO 8601 date format validation (YYYY-MM-DD)
 */

// ISO 8601 date format regex
const DATE_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

function isValidDate(value: string): boolean {
	if (!DATE_REGEX.test(value)) {
		return false;
	}
	// Additional validation: check if the date is actually valid
	const date = new Date(value);
	return !isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function parse(input: unknown): string {
	if (typeof input !== 'string') {
		throw new Error(`Invalid Date: expected string, got ${typeof input}`);
	}
	if (!isValidDate(input)) {
		throw new Error(`Invalid Date: "${input}" is not a valid ISO 8601 date (YYYY-MM-DD)`);
	}
	return input;
}

type DateAPI = {
	(input: string): string;
	parse(input: unknown): string;
	safeParse(input: unknown): { success: true; data: string } | { success: false; error: Error };
	isValid(input: string): boolean;
};

function dateImpl(input: string): string {
	return parse(input);
}

export const date: DateAPI = Object.assign(dateImpl, {
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
		return isValidDate(input);
	},
});
