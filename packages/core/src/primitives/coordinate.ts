import { parseCoordinate } from '@/validation';
import type { Coordinate } from '@paradoc/types';

export interface CoordinateBuilder {
	from(value: Coordinate): CoordinateBuilder;
	lat(value: number): CoordinateBuilder;
	lon(value: number): CoordinateBuilder;
	point(lat: number, lon: number): CoordinateBuilder;
	build(): Coordinate;
}

function createBuilder(): CoordinateBuilder {
	const _def: Partial<Coordinate> = {};

	const builder: CoordinateBuilder = {
		from(value) {
			const parsed = parseCoordinate(value);
			Object.assign(_def, parsed);
			return builder;
		},
		lat(value) {
			_def.lat = value;
			return builder;
		},
		lon(value) {
			_def.lon = value;
			return builder;
		},
		point(lat, lon) {
			_def.lat = lat;
			_def.lon = lon;
			return builder;
		},
		build() {
			return parseCoordinate(_def);
		},
	};

	return builder;
}

type CoordinateAPI = {
	(): CoordinateBuilder;
	(input: Coordinate): Coordinate;
	parse(input: unknown): Coordinate;
	safeParse(
		input: unknown,
	): { success: true; data: Coordinate } | { success: false; error: Error };
};

function coordinateImpl(): CoordinateBuilder;
function coordinateImpl(input: Coordinate): Coordinate;
function coordinateImpl(input?: Coordinate): CoordinateBuilder | Coordinate {
	if (input !== undefined) {
		return parseCoordinate(input);
	}
	return createBuilder();
}

export const coordinate: CoordinateAPI = Object.assign(coordinateImpl, {
	parse: parseCoordinate,
	safeParse: (
		input: unknown,
	): { success: true; data: Coordinate } | { success: false; error: Error } => {
		try {
			return { success: true, data: parseCoordinate(input) };
		} catch (err) {
			return { success: false, error: err as Error };
		}
	},
});
