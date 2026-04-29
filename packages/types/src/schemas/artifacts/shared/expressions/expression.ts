/**
 * Expression types for typed computed values
 *
 * These types correspond to the Expression schema in @paradoc/schemas.
 */

// ============================================================================
// Base Types
// ============================================================================

/**
 * Base interface for all expressions with common metadata.
 */
export interface BaseExpression {
  /** Display label for the computed value */
  label?: string;
  /** Description or documentation of the computed value */
  description?: string;
}

// ============================================================================
// Scalar Expressions (value is a single expression string)
// ============================================================================

/**
 * Boolean expression.
 * Evaluates to a boolean value.
 */
export interface BooleanExpression extends BaseExpression {
  type: 'boolean';
  /** Expression that evaluates to a boolean */
  value: string;
}

/**
 * String expression.
 * Evaluates to a string value.
 */
export interface StringExpression extends BaseExpression {
  type: 'string';
  /** Expression that evaluates to a string */
  value: string;
}

/**
 * Number expression.
 * Evaluates to a numeric value.
 */
export interface NumberExpression extends BaseExpression {
  type: 'number';
  /** Expression that evaluates to a number */
  value: string;
}

/**
 * Integer expression.
 * Evaluates to an integer value.
 */
export interface IntegerExpression extends BaseExpression {
  type: 'integer';
  /** Expression that evaluates to an integer */
  value: string;
}

/**
 * Percentage expression.
 * Evaluates to a percentage value (0-100).
 */
export interface PercentageExpression extends BaseExpression {
  type: 'percentage';
  /** Expression that evaluates to a percentage */
  value: string;
}

/**
 * Rating expression.
 * Evaluates to a rating value.
 */
export interface RatingExpression extends BaseExpression {
  type: 'rating';
  /** Expression that evaluates to a rating */
  value: string;
}

/**
 * Date expression.
 * Evaluates to an ISO 8601 date string (YYYY-MM-DD).
 */
export interface DateExpression extends BaseExpression {
  type: 'date';
  /** Expression that evaluates to a date string */
  value: string;
}

/**
 * Time expression.
 * Evaluates to a time string (HH:MM:SS).
 */
export interface TimeExpression extends BaseExpression {
  type: 'time';
  /** Expression that evaluates to a time string */
  value: string;
}

/**
 * Datetime expression.
 * Evaluates to an ISO 8601 datetime string.
 */
export interface DatetimeExpression extends BaseExpression {
  type: 'datetime';
  /** Expression that evaluates to a datetime string */
  value: string;
}

/**
 * Duration expression.
 * Evaluates to an ISO 8601 duration string.
 */
export interface DurationExpression extends BaseExpression {
  type: 'duration';
  /** Expression that evaluates to a duration string */
  value: string;
}

// ============================================================================
// Object Expressions (value is an object with expression strings)
// ============================================================================

/**
 * Money expression value structure.
 */
export interface MoneyExpressionValue {
  /** Expression for the monetary amount */
  amount: string;
  /** Expression for the currency code (ISO 4217) */
  currency: string;
}

/**
 * Money expression.
 * Evaluates to a Money object with amount and currency.
 */
export interface MoneyExpression extends BaseExpression {
  type: 'money';
  /** Object with expressions for money components */
  value: MoneyExpressionValue;
}

/**
 * Address expression value structure.
 */
export interface AddressExpressionValue {
  /** Expression for primary address line */
  line1: string;
  /** Expression for secondary address line (optional) */
  line2?: string;
  /** Expression for city/locality */
  locality: string;
  /** Expression for state/region */
  region: string;
  /** Expression for postal/ZIP code */
  postalCode: string;
  /** Expression for country */
  country: string;
}

/**
 * Address expression.
 * Evaluates to an Address object.
 */
export interface AddressExpression extends BaseExpression {
  type: 'address';
  /** Object with expressions for address components */
  value: AddressExpressionValue;
}

/**
 * Phone expression value structure.
 */
export interface PhoneExpressionValue {
  /** Expression for phone number (E.164 format) */
  number: string;
  /** Expression for phone type (optional) */
  type?: string;
  /** Expression for extension (optional) */
  extension?: string;
}

/**
 * Phone expression.
 * Evaluates to a Phone object.
 */
export interface PhoneExpression extends BaseExpression {
  type: 'phone';
  /** Object with expressions for phone components */
  value: PhoneExpressionValue;
}

/**
 * Coordinate expression value structure.
 */
export interface CoordinateExpressionValue {
  /** Expression for latitude */
  lat: string;
  /** Expression for longitude */
  lon: string;
}

/**
 * Coordinate expression.
 * Evaluates to a Coordinate object.
 */
export interface CoordinateExpression extends BaseExpression {
  type: 'coordinate';
  /** Object with expressions for coordinate components */
  value: CoordinateExpressionValue;
}

/**
 * Bbox expression value structure.
 */
export interface BboxExpressionValue {
  /** Expression for northern boundary latitude */
  north: string;
  /** Expression for southern boundary latitude */
  south: string;
  /** Expression for eastern boundary longitude */
  east: string;
  /** Expression for western boundary longitude */
  west: string;
}

/**
 * Bbox (bounding box) expression.
 * Evaluates to a Bbox object.
 */
export interface BboxExpression extends BaseExpression {
  type: 'bbox';
  /** Object with expressions for bbox boundaries */
  value: BboxExpressionValue;
}

/**
 * Person expression value structure.
 */
export interface PersonExpressionValue {
  /** Expression for name */
  name: string;
  /** Expression for title/prefix (optional) */
  title?: string;
  /** Expression for first name (optional) */
  firstName?: string;
  /** Expression for middle name (optional) */
  middleName?: string;
  /** Expression for last name (optional) */
  lastName?: string;
  /** Expression for suffix (optional) */
  suffix?: string;
}

/**
 * Person expression.
 * Evaluates to a Person object.
 */
export interface PersonExpression extends BaseExpression {
  type: 'person';
  /** Object with expressions for person name components */
  value: PersonExpressionValue;
}

/**
 * Organization expression value structure.
 */
export interface OrganizationExpressionValue {
  /** Expression for organization name */
  name: string;
  /** Expression for legal name (optional) */
  legalName?: string;
  /** Expression for domicile (optional) */
  domicile?: string;
  /** Expression for entity type (optional) */
  entityType?: string;
  /** Expression for entity ID (optional) */
  entityId?: string;
  /** Expression for tax ID (optional) */
  taxId?: string;
}

/**
 * Organization expression.
 * Evaluates to an Organization object.
 */
export interface OrganizationExpression extends BaseExpression {
  type: 'organization';
  /** Object with expressions for organization components */
  value: OrganizationExpressionValue;
}

/**
 * Identification expression value structure.
 */
export interface IdentificationExpressionValue {
  /** Expression for ID type */
  type: string;
  /** Expression for ID number */
  number: string;
  /** Expression for issuer (optional) */
  issuer?: string;
  /** Expression for issue date (optional) */
  issueDate?: string;
  /** Expression for expiry date (optional) */
  expiryDate?: string;
}

/**
 * Identification expression.
 * Evaluates to an Identification object.
 */
export interface IdentificationExpression extends BaseExpression {
  type: 'identification';
  /** Object with expressions for identification components */
  value: IdentificationExpressionValue;
}

// ============================================================================
// Union Type
// ============================================================================

/**
 * Scalar expression types (value is a single expression string).
 */
export type ScalarExpression =
  | BooleanExpression
  | StringExpression
  | NumberExpression
  | IntegerExpression
  | PercentageExpression
  | RatingExpression
  | DateExpression
  | TimeExpression
  | DatetimeExpression
  | DurationExpression;

/**
 * Object expression types (value is an object with property expressions).
 */
export type ObjectExpression =
  | MoneyExpression
  | AddressExpression
  | PhoneExpression
  | CoordinateExpression
  | BboxExpression
  | PersonExpression
  | OrganizationExpression
  | IdentificationExpression;

/**
 * A typed computed value with optional metadata (label, description).
 * The type property determines the expected result type and value schema.
 */
export type Expression = ScalarExpression | ObjectExpression;

/**
 * Type of a scalar expression.
 */
export type ScalarExpressionType =
  | 'boolean'
  | 'string'
  | 'number'
  | 'integer'
  | 'percentage'
  | 'rating'
  | 'date'
  | 'time'
  | 'datetime'
  | 'duration';

/**
 * Type of an object expression.
 */
export type ObjectExpressionType =
  | 'money'
  | 'address'
  | 'phone'
  | 'coordinate'
  | 'bbox'
  | 'person'
  | 'organization'
  | 'identification';

/**
 * All supported expression types.
 */
export type ExpressionType = ScalarExpressionType | ObjectExpressionType;
