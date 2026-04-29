import { parseDuration } from '@/validation';
import type { Duration } from '@paradoc/types';

export interface DurationBuilder {
	from(value: Duration): DurationBuilder;
	value(val: Duration): DurationBuilder;
	build(): Duration;
}

function createBuilder(): DurationBuilder {
	let _def: Duration = '';

	const builder: DurationBuilder = {
		from(value) {
			_def = parseDuration(value);
			return builder;
		},
		value(val) {
			_def = parseDuration(val);
			return builder;
		},
		build() {
			return _def;
		},
	};

	return builder;
}

type DurationAPI = {
	(): DurationBuilder;
	(input: Duration): Duration;
	parse(input: unknown): Duration;
	safeParse(
		input: unknown,
	): { success: true; data: Duration } | { success: false; error: Error };
};

function durationImpl(): DurationBuilder;
function durationImpl(input: Duration): Duration;
function durationImpl(input?: Duration): DurationBuilder | Duration {
	if (input !== undefined) {
		return parseDuration(input);
	}
	return createBuilder();
}

export const duration: DurationAPI = Object.assign(durationImpl, {
	parse: parseDuration,
	safeParse: (
		input: unknown,
	): { success: true; data: Duration } | { success: false; error: Error } => {
		try {
			return { success: true, data: parseDuration(input) };
		} catch (err) {
			return { success: false, error: err as Error };
		}
	},
});
