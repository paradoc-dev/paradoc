import { z } from 'zod';
import { CoordinateSchema } from './coordinate';

export const BboxSchema = z.object({
	southWest: CoordinateSchema.describe('Southwest corner coordinate (minimum latitude and longitude)'),
	northEast: CoordinateSchema.describe('Northeast corner coordinate (maximum latitude and longitude)'),
}).meta({
	title: 'Bbox',
	description: 'Geographic bounding box defined by southwest (minimum) and northeast (maximum) corner coordinates',
}).strict();
