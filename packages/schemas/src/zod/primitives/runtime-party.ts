import { z } from 'zod';
import { OrganizationSchema } from './organization';
import { PersonSchema } from './person';

const PartyIdSchema = z.string()
	.min(1)
	.describe('Identifier of this party in the fill, such as tenant-0');

/** A person filling a party role: a Person with the `id` the fill assigns it. */
export const RuntimePersonSchema = PersonSchema.extend({
	id: PartyIdSchema,
});

/** An organization filling a party role: an Organization with the `id` the fill assigns it. */
export const RuntimeOrganizationSchema = OrganizationSchema.extend({
	id: PartyIdSchema,
});
