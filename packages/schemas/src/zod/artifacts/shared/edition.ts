import { z } from 'zod';
import type { ArtifactEdition } from '@paradoc/types';
import { EditionKeySchema } from '../../primitives/artifact-selectors';

/**
 * An edition date at the issuer's precision: `YYYY`, `YYYY-MM` or
 * `YYYY-MM-DD`. A full date must name a day that exists: that branch is the
 * leap-aware date pattern of `z.iso.date`, so exported JSON Schema refuses
 * `2025-02-31` too.
 */
export const EDITION_DATE_PATTERN = new RegExp(
	`^(?:\\d{4}(?:-(?:0[1-9]|1[0-2]))?|${z.regexes.date.source.slice(1, -1)})$`,
);

export const ArtifactEditionSchema: z.ZodType<ArtifactEdition> = z.object({
	key: EditionKeySchema
		.describe('Stable edition identifier, unique among the editions of one artifact (for example 2024-03 or 3b). Lowercase letters and digits with single hyphens, and not current, latest, editions, tags or diff. It is the edition segment of a coordinate such as @org/repo/w-9/2024-03 and never changes once published.'),
	label: z.string()
		.min(1)
		.max(200)
		.describe('The issuer\'s edition text exactly as printed, such as "Rev. March 2024". For display only.'),
	date: z.string()
		.regex(EDITION_DATE_PATTERN, 'Expected an edition date as YYYY, YYYY-MM or YYYY-MM-DD that names a real day')
		.describe('When the issuer released the edition, at the precision the issuer gives: YYYY, YYYY-MM or YYYY-MM-DD.')
		.optional(),
	effectiveFrom: z.iso.date()
		.describe('The date the edition takes effect. Only when the issuer prints one.')
		.optional(),
}).strict().meta({
	title: 'ArtifactEdition',
	description: 'One edition of an issued artifact, as printed by its issuer. Facts the issuer decides later, such as which edition is current, are not part of it.',
});
