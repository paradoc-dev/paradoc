import { parsePerson } from '@/validation';
import type { Person } from '@paradoc/types';

export interface PersonBuilder {
	from(value: Person): PersonBuilder;
	name(value: string): PersonBuilder;
	title(value: string | undefined): PersonBuilder;
	firstName(value: string | undefined): PersonBuilder;
	middleName(value: string | undefined): PersonBuilder;
	lastName(value: string | undefined): PersonBuilder;
	suffix(value: string | undefined): PersonBuilder;
	build(): Person;
}

function createBuilder(): PersonBuilder {
	const _def: Partial<Person> = {};

	const builder: PersonBuilder = {
		from(value) {
			const parsed = parsePerson(value);
			Object.assign(_def, parsed);
			return builder;
		},
		name(value) {
			_def.name = value;
			return builder;
		},
		title(value) {
			_def.title = value;
			return builder;
		},
		firstName(value) {
			_def.firstName = value;
			return builder;
		},
		middleName(value) {
			_def.middleName = value;
			return builder;
		},
		lastName(value) {
			_def.lastName = value;
			return builder;
		},
		suffix(value) {
			_def.suffix = value;
			return builder;
		},
		build() {
			return parsePerson(_def);
		},
	};

	return builder;
}

type PersonAPI = {
	(): PersonBuilder;
	(input: Person): Person;
	parse(input: unknown): Person;
	safeParse(
		input: unknown,
	): { success: true; data: Person } | { success: false; error: Error };
};

function personImpl(): PersonBuilder;
function personImpl(input: Person): Person;
function personImpl(input?: Person): PersonBuilder | Person {
	if (input !== undefined) {
		return parsePerson(input);
	}
	return createBuilder();
}

export const person: PersonAPI = Object.assign(personImpl, {
	parse: parsePerson,
	safeParse: (
		input: unknown,
	): { success: true; data: Person } | { success: false; error: Error } => {
		try {
			return { success: true, data: parsePerson(input) };
		} catch (err) {
			return { success: false, error: err as Error };
		}
	},
});
