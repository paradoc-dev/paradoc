/**
 * Money serializer - validator and stringifier for monetary amounts
 */

import { isObject } from '../utils'

/**
 * Assert Money object is valid. Throws error if invalid.
 */
export function assertMoney(value: unknown): void {
	if (!isObject(value)) {
		throw new TypeError('Invalid money: must be a Money object')
	}
	if (!('amount' in value)) {
		throw new Error('Invalid money: missing required property "amount"')
	}
	const amount = (value as Record<string, unknown>).amount
	if (typeof amount !== 'number') {
		throw new TypeError(`Invalid money: "amount" must be a number, got ${typeof amount}`)
	}
	if (!Number.isFinite(amount)) {
		throw new Error('Invalid money: "amount" must be a finite number')
	}
}
