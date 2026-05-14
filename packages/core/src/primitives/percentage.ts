/**
 * Percentage primitive builder with optional range validation
 */

type PercentageOptions = {
	min?: number;
	max?: number;
	precision?: number;
};

const DEFAULT_PRECISION = 2;

function isValidPercentage(
	value: number,
	options: PercentageOptions = {},
): boolean {
	const { min, max } = options;
	if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
		return false;
	}
	if (min !== undefined && value < min) {
		return false;
	}
	if (max !== undefined && value > max) {
		return false;
	}
	return true;
}

function parse(input: unknown, options: PercentageOptions = {}): number {
	const { min, max, precision = DEFAULT_PRECISION } = options;

	if (typeof input !== 'number') {
		throw new Error(`Invalid Percentage: expected number, got ${typeof input}`);
	}
	if (isNaN(input) || !isFinite(input)) {
		throw new Error(`Invalid Percentage: value must be a finite number`);
	}
	if (min !== undefined && input < min) {
		throw new Error(
			`Invalid Percentage: ${input} is below the minimum (${min})`,
		);
	}
	if (max !== undefined && input > max) {
		throw new Error(
			`Invalid Percentage: ${input} is above the maximum (${max})`,
		);
	}

	// Round to specified precision
	const factor = Math.pow(10, precision);
	return Math.round(input * factor) / factor;
}

type PercentageAPI = {
	(input: number): number;
	parse(input: unknown, options?: PercentageOptions): number;
	safeParse(
		input: unknown,
		options?: PercentageOptions,
	): { success: true; data: number } | { success: false; error: Error };
	isValid(input: number, options?: PercentageOptions): boolean;
	/** Convert a decimal (0-1) to percentage (0-100) */
	fromDecimal(decimal: number): number;
	/** Convert a percentage (0-100) to decimal (0-1) */
	toDecimal(percentage: number): number;
};

function percentageImpl(input: number): number {
	return parse(input);
}

export const percentage: PercentageAPI = Object.assign(percentageImpl, {
	parse,
	safeParse: (
		input: unknown,
		options?: PercentageOptions,
	): { success: true; data: number } | { success: false; error: Error } => {
		try {
			return { success: true, data: parse(input, options) };
		} catch (err) {
			return { success: false, error: err as Error };
		}
	},
	isValid: (input: number, options?: PercentageOptions): boolean => {
		return isValidPercentage(input, options);
	},
	fromDecimal: (decimal: number): number => {
		return parse(decimal * 100);
	},
	toDecimal: (pct: number): number => {
		return parse(pct) / 100;
	},
});
