import { InvalidArgumentError } from 'commander';

/**
 * Helper function for collecting repeated option values
 * Used with Commander.js options that can be specified multiple times
 *
 * @example
 * .option('--field <value>', 'Add field', collect, [])
 *
 * $ command --field a --field b --field c
 * // Results in: ['a', 'b', 'c']
 */
export function collect(value: string, previous: string[]): string[] {
	return previous.concat([value]);
}

/**
 * Collect one repeated `--header "Name: Value"` option into a header record.
 *
 * A header is usually a credential, so a malformed one fails the command by
 * name instead of being dropped: a request sent without it would fail later
 * as a confusing 401 or 404.
 *
 * @example
 * .option('--header <header>', 'Add HTTP header', collectHeader, {})
 */
export function collectHeader(value: string, previous: Record<string, string>): Record<string, string> {
	const colonIndex = value.indexOf(':');
	if (colonIndex === -1) {
		throw new InvalidArgumentError(`Invalid header "${value}": expected "Name: Value".`);
	}
	const name = value.substring(0, colonIndex).trim();
	const headerValue = value.substring(colonIndex + 1).trim();
	if (!name) {
		throw new InvalidArgumentError(`Invalid header "${value}": the header name is empty.`);
	}
	if (!headerValue) {
		throw new InvalidArgumentError(`Invalid header "${name}": the header value is empty.`);
	}
	return { ...previous, [name]: headerValue };
}
