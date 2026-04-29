/**
 * Form field types for design-time field definitions
 */

import type {
  Coordinate,
  Bbox,
  Money,
  Address,
  Phone,
  Duration,
  Person,
  Organization,
  Identification,
} from "../../primitives";

// ============================================================================
// Base Field Properties
// ============================================================================

/**
 * Base field properties shared across all field types.
 * Provides common properties like label, required, visible, and description.
 */
export interface BaseField {
  /** Human-readable label for the field. */
  label?: string;
  /** Whether this field is required. Can be a boolean or expression. */
  required?: boolean | string;
  /** Whether this field is visible. Can be a boolean or expression. Defaults to true. */
  visible?: boolean | string;
  /** Long-form description or helper text displayed in the UI. */
  description?: string;
}

/**
 * A fieldset field that contains nested fields.
 * This is a specific discriminated type where type is always 'fieldset'.
 */
export interface FieldsetField extends BaseField {
  /** Literal 'fieldset' discriminator. */
  type: "fieldset";
  /** Nested field definitions keyed by identifier. */
  fields: Record<string, FormField>;
}

/**
 * Design-time form field definition.
 * A field is any control that captures user input or displays data.
 *
 * Note: This is a union type of all specific field types, not a generic interface.
 * This allows TypeScript to properly discriminate field types and access type-specific properties.
 */
export type FormField =
  | TextField
  | BooleanField
  | NumberField
  | CoordinateField
  | BboxField
  | MoneyField
  | AddressField
  | PhoneField
  | DurationField
  | EmailField
  | UuidField
  | UriField
  | EnumField
  | DateField
  | DatetimeField
  | TimeField
  | PersonField
  | OrganizationField
  | IdentificationField
  | MultiselectField
  | PercentageField
  | RatingField
  | FieldsetField;

// ============================================================================
// Specific Field Types (Discriminated Union Types)
// ============================================================================

/**
 * Text input field.
 */
export interface TextField extends BaseField {
  /** Discriminator for text field type. */
  type: "text";
  /** Minimum character length. */
  minLength?: number;
  /** Maximum character length. */
  maxLength?: number;
  /** Regular expression pattern for validation. */
  pattern?: string;
  /** Default value for the field. */
  default?: string;
}

/**
 * Boolean checkbox/toggle field.
 */
export interface BooleanField extends BaseField {
  /** Discriminator for boolean field type. */
  type: "boolean";
  /** Default value for the field. */
  default?: boolean;
}

/**
 * Number input field.
 */
export interface NumberField extends BaseField {
  /** Discriminator for number field type. */
  type: "number";
  /** Minimum allowed value. */
  min?: number;
  /** Maximum allowed value. */
  max?: number;
  /** Default value for the field. */
  default?: number;
}

/**
 * Coordinate (latitude/longitude) input field.
 */
export interface CoordinateField extends BaseField {
  /** Discriminator for coordinate field type. */
  type: "coordinate";
  /** Default value for the field. */
  default?: Coordinate;
}

/**
 * Bounding box (geographic area) input field.
 */
export interface BboxField extends BaseField {
  /** Discriminator for bbox field type. */
  type: "bbox";
  /** Default value for the field. */
  default?: Bbox;
}

/**
 * Money amount input field.
 */
export interface MoneyField extends BaseField {
  /** Discriminator for money field type. */
  type: "money";
  /** Minimum allowed amount. */
  min?: number;
  /** Maximum allowed amount. */
  max?: number;
  /** Default value for the field. */
  default?: Money;
}

/**
 * Address input field.
 */
export interface AddressField extends BaseField {
  /** Discriminator for address field type. */
  type: "address";
  /** Default value for the field. */
  default?: Address;
}

/**
 * Phone number input field.
 */
export interface PhoneField extends BaseField {
  /** Discriminator for phone field type. */
  type: "phone";
  /** Default value for the field. */
  default?: Phone;
}

/**
 * Duration (ISO 8601) input field.
 */
export interface DurationField extends BaseField {
  /** Discriminator for duration field type. */
  type: "duration";
  /** Default value for the field. */
  default?: Duration;
}

/**
 * Email address input field.
 */
export interface EmailField extends BaseField {
  /** Discriminator for email field type. */
  type: "email";
  /** Minimum character length. */
  minLength?: number;
  /** Maximum character length. */
  maxLength?: number;
  /** Default value for the field. */
  default?: string;
}

/**
 * UUID input field.
 */
export interface UuidField extends BaseField {
  /** Discriminator for UUID field type. */
  type: "uuid";
  /** Minimum character length. */
  minLength?: number;
  /** Maximum character length. */
  maxLength?: number;
  /** Regular expression pattern for validation. */
  pattern?: string;
  /** Default value for the field. */
  default?: string;
}

/**
 * URI/URL input field.
 */
export interface UriField extends BaseField {
  /** Discriminator for URI field type. */
  type: "uri";
  /** Minimum character length. */
  minLength?: number;
  /** Maximum character length. */
  maxLength?: number;
  /** Regular expression pattern for validation. */
  pattern?: string;
  /** Default value for the field. */
  default?: string;
}

/**
 * Enum/select dropdown field.
 */
export interface EnumField extends BaseField {
  /** Discriminator for enum field type. */
  type: "enum";
  /** Available options for selection. */
  enum: readonly (string | number)[];
  /** Default value for the field. */
  default?: string | number;
}

/**
 * Date input field (ISO 8601 format: YYYY-MM-DD).
 */
export interface DateField extends BaseField {
  /** Discriminator for date field type. */
  type: "date";
  /** Minimum allowed date in ISO 8601 format. */
  min?: string;
  /** Maximum allowed date in ISO 8601 format. */
  max?: string;
  /** Default value for the field. */
  default?: string;
}

/**
 * Datetime input field (ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ).
 */
export interface DatetimeField extends BaseField {
  /** Discriminator for datetime field type. */
  type: "datetime";
  /** Minimum allowed datetime in ISO 8601 format. */
  min?: string;
  /** Maximum allowed datetime in ISO 8601 format. */
  max?: string;
  /** Default value for the field. */
  default?: string;
}

/**
 * Time input field (HH:MM:SS format).
 */
export interface TimeField extends BaseField {
  /** Discriminator for time field type. */
  type: "time";
  /** Minimum allowed time. */
  min?: string;
  /** Maximum allowed time. */
  max?: string;
  /** Default value for the field. */
  default?: string;
}

/**
 * Person information input field.
 */
export interface PersonField extends BaseField {
  /** Discriminator for person field type. */
  type: "person";
  /** Default value for the field. */
  default?: Person;
}

/**
 * Organization information input field.
 */
export interface OrganizationField extends BaseField {
  /** Discriminator for organization field type. */
  type: "organization";
  /** Default value for the field. */
  default?: Organization;
}

/**
 * Identification document input field.
 */
export interface IdentificationField extends BaseField {
  /** Discriminator for identification field type. */
  type: "identification";
  /** Allowed identification document types. */
  allowedTypes?: readonly string[];
  /** Default value for the field. */
  default?: Identification;
}

/**
 * Multi-select field allowing multiple selections from options.
 */
export interface MultiselectField extends BaseField {
  /** Discriminator for multiselect field type. */
  type: "multiselect";
  /** Available options for selection. */
  enum: readonly (string | number)[];
  /** Minimum number of selections required. */
  min?: number;
  /** Maximum number of selections allowed. */
  max?: number;
  /** Default value for the field. */
  default?: readonly (string | number)[];
}

/**
 * Percentage input field (0-100 by default).
 */
export interface PercentageField extends BaseField {
  /** Discriminator for percentage field type. */
  type: "percentage";
  /** Minimum allowed percentage. */
  min?: number;
  /** Maximum allowed percentage. */
  max?: number;
  /** Number of decimal places. */
  precision?: number;
  /** Default value for the field. */
  default?: number;
}

/**
 * Rating input field (1-5 by default).
 */
export interface RatingField extends BaseField {
  /** Discriminator for rating field type. */
  type: "rating";
  /** Minimum rating value. */
  min?: number;
  /** Maximum rating value. */
  max?: number;
  /** Rating increment step. */
  step?: number;
  /** Default value for the field. */
  default?: number;
}

