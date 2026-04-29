import { parseOrganization } from '@/validation';
import type { Organization } from '@paradoc/types';

export interface OrganizationBuilder {
	from(value: Organization): OrganizationBuilder;
	name(value: string): OrganizationBuilder;
	legalName(value: string | undefined): OrganizationBuilder;
	domicile(value: string | undefined): OrganizationBuilder;
	entityType(value: string | undefined): OrganizationBuilder;
	entityId(value: string | undefined): OrganizationBuilder;
	taxId(value: string | undefined): OrganizationBuilder;
	build(): Organization;
}

function createBuilder(): OrganizationBuilder {
	const _def: Partial<Organization> = {};

	const builder: OrganizationBuilder = {
		from(value) {
			const parsed = parseOrganization(value);
			Object.assign(_def, parsed);
			return builder;
		},
		name(value) {
			_def.name = value;
			return builder;
		},
		legalName(value) {
			_def.legalName = value;
			return builder;
		},
		domicile(value) {
			_def.domicile = value;
			return builder;
		},
		entityType(value) {
			_def.entityType = value;
			return builder;
		},
		entityId(value) {
			_def.entityId = value;
			return builder;
		},
		taxId(value) {
			_def.taxId = value;
			return builder;
		},
		build() {
			return parseOrganization(_def);
		},
	};

	return builder;
}

type OrganizationAPI = {
	(): OrganizationBuilder;
	(input: Organization): Organization;
	parse(input: unknown): Organization;
	safeParse(
		input: unknown,
	): { success: true; data: Organization } | { success: false; error: Error };
};

function organizationImpl(): OrganizationBuilder;
function organizationImpl(input: Organization): Organization;
function organizationImpl(input?: Organization): OrganizationBuilder | Organization {
	if (input !== undefined) {
		return parseOrganization(input);
	}
	return createBuilder();
}

export const organization: OrganizationAPI = Object.assign(organizationImpl, {
	parse: parseOrganization,
	safeParse: (
		input: unknown,
	): { success: true; data: Organization } | { success: false; error: Error } => {
		try {
			return { success: true, data: parseOrganization(input) };
		} catch (err) {
			return { success: false, error: err as Error };
		}
	},
});
