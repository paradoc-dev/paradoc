import { z } from 'zod';

export const CoordinateSchema = z.object({
	lat: z.number()
		.min(-90)
		.max(90)
		.describe('Latitude in decimal degrees (WGS84), range -90 (South Pole) to 90 (North Pole)'),
	lon: z.number()
		.min(-180)
		.max(180)
		.describe('Longitude in decimal degrees (WGS84), range -180 (west) to 180 (east)'),
}).meta({
	title: 'Coordinate',
	description: 'Geographic coordinate (WGS84) with latitude and longitude in decimal degrees',
}).strict();
