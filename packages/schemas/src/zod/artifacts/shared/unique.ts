/**
 * Report every occurrence of a repeated identity in an ordered definition
 * collection. Both the first declaration and each repeated declaration get a
 * path so callers can locate the complete conflicting pair.
 */
export function addDuplicateIdentityIssues<T>(
	members: readonly T[],
	identityOf: (member: T) => string,
	options: {
		collection: string;
		property: string;
		label: string;
	},
	addIssue: (path: Array<string | number>, message: string) => void,
): void {
	const firstIndexByIdentity = new Map<string, number>();

	for (const [index, member] of members.entries()) {
		const identity = identityOf(member);
		const firstIndex = firstIndexByIdentity.get(identity);

		if (firstIndex === undefined) {
			firstIndexByIdentity.set(identity, index);
			continue;
		}

		const firstPath = `${options.collection}.${firstIndex}.${options.property}`;
		const message = `Duplicate ${options.label} "${identity}". First declared at ${firstPath}.`;
		addIssue([firstIndex, options.property], message);
		addIssue([index, options.property], message);
	}
}
