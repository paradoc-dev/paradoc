import { z } from 'zod';

export const DurationSchema = z.string()
	.regex(/^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?$/)
	.meta({
		title: 'Duration',
		description: 'ISO 8601 duration string representing a time period. Format: P[n]Y[n]M[n]DT[n]H[n]M[n]S where P indicates period, T separates date and time components. Examples: P1Y (1 year), P3M (3 months), P1DT12H (1 day 12 hours), PT30M (30 minutes), PT5S (5 seconds)',
	});
