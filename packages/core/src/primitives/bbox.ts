import { parseBbox, parseCoordinate } from '@/validation';
import type { Bbox, Coordinate } from '@paradoc/types';

export interface BboxBuilder {
	from(value: Bbox): BboxBuilder;
	southWest(value: Coordinate): BboxBuilder;
	northEast(value: Coordinate): BboxBuilder;
	bounds(southWest: Coordinate, northEast: Coordinate): BboxBuilder;
	build(): Bbox;
}

function createBuilder(): BboxBuilder {
	const _def: Partial<Bbox> = {};

	const builder: BboxBuilder = {
		from(value) {
			const parsed = parseBbox(value);
			Object.assign(_def, parsed);
			return builder;
		},
		southWest(value) {
			_def.southWest = parseCoordinate(value);
			return builder;
		},
		northEast(value) {
			_def.northEast = parseCoordinate(value);
			return builder;
		},
		bounds(southWest, northEast) {
			_def.southWest = parseCoordinate(southWest);
			_def.northEast = parseCoordinate(northEast);
			return builder;
		},
		build() {
			return parseBbox(_def);
		},
	};

	return builder;
}

type BboxAPI = {
	(): BboxBuilder;
	(input: Bbox): Bbox;
	parse(input: unknown): Bbox;
	safeParse(
		input: unknown,
	): { success: true; data: Bbox } | { success: false; error: Error };
};

function bboxImpl(): BboxBuilder;
function bboxImpl(input: Bbox): Bbox;
function bboxImpl(input?: Bbox): BboxBuilder | Bbox {
	if (input !== undefined) {
		return parseBbox(input);
	}
	return createBuilder();
}

export const bbox: BboxAPI = Object.assign(bboxImpl, {
	parse: parseBbox,
	safeParse: (
		input: unknown,
	): { success: true; data: Bbox } | { success: false; error: Error } => {
		try {
			return { success: true, data: parseBbox(input) };
		} catch (err) {
			return { success: false, error: err as Error };
		}
	},
});
