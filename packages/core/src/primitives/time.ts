/**
 * Time primitive builder with HH:MM:SS format validation
 */

// Time format pattern (HH:MM:SS with an optional fraction), exported as a string
// so the compiled field schema (@/inference/form-payload.ts) can use the exact
// same pattern the primitive validates against.
export const TIME_PATTERN = '^(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?$';
const TIME_REGEX = new RegExp(TIME_PATTERN);

function isValidTime(value: string): boolean {
	return TIME_REGEX.test(value);
}

function parse(input: unknown): string {
	if (typeof input !== 'string') {
		throw new Error(`Invalid Time: expected string, got ${typeof input}`);
	}
	if (!isValidTime(input)) {
		throw new Error(
			`Invalid Time: "${input}" is not a valid time format (HH:MM:SS)`,
		);
	}
	return input;
}

type TimeAPI = {
	(input: string): string;
	parse(input: unknown): string;
	safeParse(
		input: unknown,
	): { success: true; data: string } | { success: false; error: Error };
	isValid(input: string): boolean;
	/** Get current time as HH:MM:SS string */
	now(): string;
};

function timeImpl(input: string): string {
	return parse(input);
}

export const time: TimeAPI = Object.assign(timeImpl, {
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
		return isValidTime(input);
	},
	now: (): string => {
		const now = new Date();
		const hours = now.getHours().toString().padStart(2, '0');
		const minutes = now.getMinutes().toString().padStart(2, '0');
		const seconds = now.getSeconds().toString().padStart(2, '0');
		return `${hours}:${minutes}:${seconds}`;
	},
});
