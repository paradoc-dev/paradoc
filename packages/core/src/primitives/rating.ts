/**
 * Rating primitive builder with range validation (1-5 by default)
 */

type RatingOptions = {
	min?: number;
	max?: number;
	step?: number;
};

const DEFAULT_OPTIONS: Required<RatingOptions> = {
	min: 1,
	max: 5,
	step: 1,
};

function isValidRating(value: number, options: RatingOptions = {}): boolean {
	const { min, max, step } = { ...DEFAULT_OPTIONS, ...options };

	if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
		return false;
	}

	if (value < min || value > max) {
		return false;
	}

	// Check if value aligns with step (e.g., 1, 1.5, 2, 2.5 for step=0.5)
	const stepsFromMin = (value - min) / step;
	return Math.abs(stepsFromMin - Math.round(stepsFromMin)) < 0.0001;
}

function parse(input: unknown, options: RatingOptions = {}): number {
	const { min, max, step } = { ...DEFAULT_OPTIONS, ...options };

	if (typeof input !== 'number') {
		throw new Error(`Invalid Rating: expected number, got ${typeof input}`);
	}
	if (isNaN(input) || !isFinite(input)) {
		throw new Error(`Invalid Rating: value must be a finite number`);
	}
	if (input < min || input > max) {
		throw new Error(
			`Invalid Rating: ${input} is outside the valid range (${min}-${max})`,
		);
	}

	// Check step alignment
	const stepsFromMin = (input - min) / step;
	if (Math.abs(stepsFromMin - Math.round(stepsFromMin)) >= 0.0001) {
		throw new Error(
			`Invalid Rating: ${input} does not align with step size ${step} (valid values start at ${min} and increment by ${step})`,
		);
	}

	return input;
}

type RatingAPI = {
	(input: number): number;
	parse(input: unknown, options?: RatingOptions): number;
	safeParse(
		input: unknown,
		options?: RatingOptions,
	): { success: true; data: number } | { success: false; error: Error };
	isValid(input: number, options?: RatingOptions): boolean;
};

function ratingImpl(input: number): number {
	return parse(input);
}

export const rating: RatingAPI = Object.assign(ratingImpl, {
	parse,
	safeParse: (
		input: unknown,
		options?: RatingOptions,
	): { success: true; data: number } | { success: false; error: Error } => {
		try {
			return { success: true, data: parse(input, options) };
		} catch (err) {
			return { success: false, error: err as Error };
		}
	},
	isValid: (input: number, options?: RatingOptions): boolean => {
		return isValidRating(input, options);
	},
});
