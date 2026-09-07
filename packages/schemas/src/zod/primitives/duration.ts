import { z } from 'zod';

/**
 * Canonical ISO 8601 duration pattern shared by schemas and runtime validators.
 *
 * A duration must contain a date or time component after `P`. When `T` is
 * present, it must be followed by at least one time component. Weeks remain
 * supported for compatibility with the duration serializer.
 */
export const ISO_8601_DURATION_PATTERN = String.raw`^P(?=\d|T\d)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(?:T(?=\d)(\d+H)?(\d+M)?(\d+(?:\.\d+)?S)?)?$`;

export const ISO_8601_DURATION_REGEX = new RegExp(ISO_8601_DURATION_PATTERN);

export const DurationSchema = z.string()
	.regex(ISO_8601_DURATION_REGEX)
	.meta({
		title: 'Duration',
		description: 'ISO 8601 duration string representing a time period. Format: P[n]Y[n]M[n]W[n]DT[n]H[n]M[n]S where P indicates period, T separates date and time components. Examples: P1Y (1 year), P3M (3 months), P2W (2 weeks), P1DT12H (1 day 12 hours), PT30M (30 minutes), PT5S (5 seconds)',
	});
