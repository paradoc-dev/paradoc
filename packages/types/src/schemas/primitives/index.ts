/**
 * Core primitive/data types that correspond to schemas in @paradoc/schemas.
 * These are the building blocks used in form definitions and filled data.
 */

/**
 * Custom key-value pairs for storing domain-specific or organizational metadata.
 *
 * @remarks
 * Key constraints:
 * - Pattern: `^[A-Za-z0-9]([A-Za-z0-9]|-[A-Za-z0-9])*$`
 * - Length: 1-100 characters
 * - Must start with alphanumeric, can contain alphanumeric and hyphens
 *
 * Value constraints:
 * - Strings: max 500 characters
 * - Numbers, booleans, or null also allowed
 */
export interface Metadata {
	[key: string]: string | number | boolean | null
}

/**
 * Monetary amount paired with ISO 4217 currency code.
 *
 * @example
 * ```ts
 * const price: Money = { amount: 99.99, currency: "USD" };
 * ```
 */
export interface Money {
	/** Amount expressed in decimal form (supports negative values). */
	amount: number
	/**
	 * ISO 4217 alpha-3 currency code (e.g., USD, EUR, GBP).
	 * @pattern ^[A-Z]{3}$
	 * @minLength 3
	 * @maxLength 3
	 */
	currency: string
}

/**
 * Postal address with street, locality, region, postal code, and country.
 *
 * @example
 * ```ts
 * const addr: Address = {
 *   line1: "123 Main St",
 *   locality: "New York",
 *   region: "NY",
 *   postalCode: "10001",
 *   country: "US"
 * };
 * ```
 */
export interface Address {
	/**
	 * Primary address line (street address, PO box, company name).
	 * @minLength 1
	 * @maxLength 200
	 */
	line1: string
	/**
	 * Secondary address line (apartment, suite, unit, building).
	 * @maxLength 200
	 */
	line2?: string
	/**
	 * City, town, or locality.
	 * @minLength 1
	 * @maxLength 200
	 */
	locality: string
	/**
	 * State, province, or region.
	 * @minLength 1
	 * @maxLength 100
	 */
	region: string
	/**
	 * Postal or ZIP code.
	 * @pattern ^[A-Z0-9\s-]+$
	 * @minLength 3
	 * @maxLength 20
	 */
	postalCode: string
	/**
	 * ISO 3166-1 country code (e.g., "US", "GB") or full country name.
	 * @minLength 2
	 * @maxLength 100
	 */
	country: string
}

/**
 * Phone number in E.164 format with optional type/extension.
 *
 * @example
 * ```ts
 * const phone: Phone = { number: "+14155552671", type: "mobile" };
 * ```
 */
export interface Phone {
	/**
	 * Phone number in international E.164 format (e.g., +14155552671).
	 * @pattern ^\+[1-9]\d{1,14}$
	 * @minLength 8
	 * @maxLength 16
	 */
	number: string
	/**
	 * Category/usage of the number (mobile, work, home, etc.).
	 * @minLength 1
	 * @maxLength 50
	 */
	type?: string
	/**
	 * Optional extension digits.
	 * @minLength 1
	 * @maxLength 20
	 */
	extension?: string
}

/**
 * Person name information with required `name` and optional components.
 *
 * @example
 * ```ts
 * const person: Person = {
 *   name: "Dr. Jane Smith Jr.",
 *   title: "Dr.",
 *   firstName: "Jane",
 *   lastName: "Smith",
 *   suffix: "Jr."
 * };
 * ```
 */
export interface Person {
	/**
	 * Full name as a single string.
	 * @minLength 1
	 * @maxLength 200
	 */
	name: string
	/**
	 * Optional prefix or honorific (Mr., Dr., etc.).
	 * @minLength 1
	 * @maxLength 50
	 */
	title?: string
	/**
	 * First/given name.
	 * @minLength 1
	 * @maxLength 100
	 */
	firstName?: string
	/**
	 * Middle name or initial.
	 * @minLength 1
	 * @maxLength 100
	 */
	middleName?: string
	/**
	 * Last/family name.
	 * @minLength 1
	 * @maxLength 100
	 */
	lastName?: string
	/**
	 * Suffix (Jr., Sr., III, etc.).
	 * @minLength 1
	 * @maxLength 50
	 */
	suffix?: string
}

/**
 * Organization identity with legal and registration details.
 *
 * @example
 * ```ts
 * const org: Organization = {
 *   name: "Acme Corp",
 *   legalName: "Acme Corporation Inc.",
 *   entityType: "corporation",
 *   taxId: "12-3456789"
 * };
 * ```
 */
export interface Organization {
	/**
	 * Common or trade name.
	 * @minLength 1
	 * @maxLength 200
	 */
	name: string
	/**
	 * Registered/legal name.
	 * @minLength 1
	 * @maxLength 200
	 */
	legalName?: string
	/**
	 * Country/region of domicile.
	 * @minLength 1
	 * @maxLength 100
	 */
	domicile?: string
	/**
	 * Legal entity type (corporation, LLC, etc.).
	 * @minLength 1
	 * @maxLength 100
	 */
	entityType?: string
	/**
	 * Business identification number.
	 * @minLength 1
	 * @maxLength 100
	 */
	entityId?: string
	/**
	 * Tax identification number.
	 * @minLength 1
	 * @maxLength 100
	 */
	taxId?: string
}

/**
 * Geographic coordinate in WGS84 with latitude/longitude in decimal degrees.
 *
 * @example
 * ```ts
 * const coord: Coordinate = { lat: 40.7128, lon: -74.0060 }; // New York City
 * ```
 */
export interface Coordinate {
	/**
	 * Latitude in decimal degrees, range -90 to 90.
	 * @minimum -90
	 * @maximum 90
	 */
	lat: number
	/**
	 * Longitude in decimal degrees, range -180 to 180.
	 * @minimum -180
	 * @maximum 180
	 */
	lon: number
}

/**
 * Geographic bounding box defined by southwest (minimum) and northeast (maximum) coordinates.
 *
 * @example
 * ```ts
 * const bbox: Bbox = {
 *   southWest: { lat: 40.4774, lon: -74.2591 },
 *   northEast: { lat: 40.9176, lon: -73.7004 }
 * }; // Greater NYC area
 * ```
 */
export interface Bbox {
	/** Southwest corner coordinate, representing minimum latitude/longitude. */
	southWest: Coordinate
	/** Northeast corner coordinate, representing maximum latitude/longitude. */
	northEast: Coordinate
}

/**
 * ISO 8601 duration string representing a time period.
 *
 * Format: `P[n]Y[n]M[n]DT[n]H[n]M[n]S` where P indicates period,
 * T separates date and time components.
 *
 * @pattern ^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?$
 *
 * @example
 * - `"P1Y"` - 1 year
 * - `"P3M"` - 3 months
 * - `"P1DT12H"` - 1 day and 12 hours
 * - `"PT30M"` - 30 minutes
 * - `"PT5S"` - 5 seconds
 */
export type Duration = string

/**
 * Identification document details (e.g., passport, SSN, driver's license).
 *
 * @example
 * ```ts
 * const id: Identification = {
 *   type: "passport",
 *   number: "AB1234567",
 *   issuer: "US",
 *   issueDate: "2020-01-15",
 *   expiryDate: "2030-01-14"
 * };
 * ```
 */
export interface Identification {
	/**
	 * Identification type (passport, ssn, license, etc.).
	 * @minLength 1
	 * @maxLength 50
	 */
	type: string
	/**
	 * Document/identifier number.
	 * @minLength 1
	 * @maxLength 100
	 */
	number: string
	/**
	 * Issuing authority, country, or state.
	 * @minLength 1
	 * @maxLength 100
	 */
	issuer?: string
	/**
	 * Issue date in ISO 8601 format (YYYY-MM-DD).
	 * @format date
	 */
	issueDate?: string
	/**
	 * Expiration date in ISO 8601 format (YYYY-MM-DD).
	 * @format date
	 */
	expiryDate?: string
}

/**
 * Attachment
 *
 * Represents an attached document (filled data).
 * The key in the record is the annex identifier (the key from form.annexes).
 *
 * @example
 * ```ts
 * const attachment: Attachment = {
 *   name: "contract.pdf",
 *   mimeType: "application/pdf",
 *   checksum: "sha256:abc123..."
 * };
 * ```
 */
export interface Attachment {
	/**
	 * Original file name.
	 * @minLength 1
	 * @maxLength 255
	 */
	name: string;
	/**
	 * MIME type of the attached file.
	 * @minLength 1
	 * @maxLength 100
	 */
	mimeType: string;
	/**
	 * SHA-256 checksum for integrity verification.
	 * @pattern ^sha256:[a-f0-9]{64}$
	 */
	checksum?: string;
}

/**
 * Signature
 *
 * Represents a captured signature (filled data).
 *
 * @example
 * ```ts
 * const sig: Signature = {
 *   timestamp: "2024-01-15T10:30:00Z",
 *   method: "drawn",
 *   type: "signature",
 *   image: "data:image/png;base64,..."
 * };
 * ```
 */
export interface Signature {
	/**
	 * Base64-encoded signature image or data URI.
	 * @minLength 1
	 */
	image?: string;
	/**
	 * ISO 8601 date-time when the signature was captured.
	 * @format date-time
	 */
	timestamp: string;
	/** Method used to capture the signature. */
	method: 'drawn' | 'typed' | 'uploaded' | 'certificate';
	/**
	 * Whether this is a full signature or initials.
	 * @default "signature"
	 */
	type?: 'signature' | 'initials';
	/** Additional metadata (IP address, device info, etc.). */
	metadata?: Record<string, unknown>;
}
