/**
 * Nested member names of each complex field type, and each member's
 * @paradoc/expr type. Field-path collection (which needs only the names) and
 * type-environment registration (which needs the types too) both read this
 * one table, so the two cannot silently disagree about a complex type's
 * members the way they used to.
 */

import { T, type ExprType } from '@paradoc/expr'

export const COMPLEX_TYPE_PROPERTIES: Record<string, Record<string, ExprType>> = {
	money: { amount: T.number, currency: T.string },
	address: {
		line1: T.string,
		line2: T.string,
		locality: T.string,
		region: T.string,
		postalCode: T.string,
		country: T.string,
	},
	phone: { number: T.string, type: T.string, extension: T.string },
	coordinate: { lat: T.number, lon: T.number },
	bbox: {
		southWest: T.object,
		'southWest.lat': T.number,
		'southWest.lon': T.number,
		northEast: T.object,
		'northEast.lat': T.number,
		'northEast.lon': T.number,
	},
	duration: {
		years: T.number,
		months: T.number,
		weeks: T.number,
		days: T.number,
		hours: T.number,
		minutes: T.number,
		seconds: T.number,
	},
	person: {
		name: T.string,
		firstName: T.string,
		middleName: T.string,
		lastName: T.string,
		suffix: T.string,
		title: T.string,
	},
	organization: {
		name: T.string,
		legalName: T.string,
		domicile: T.string,
		entityType: T.string,
		entityId: T.string,
		taxId: T.string,
	},
	identification: {
		type: T.string,
		number: T.string,
		issuer: T.string,
		issueDate: T.date,
		expiryDate: T.date,
	},
}
