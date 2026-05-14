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
