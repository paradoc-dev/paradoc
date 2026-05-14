/**
 * Form artifact type definition and form-specific structures
 */

import type { DefsSection } from "../shared/expressions";
import type { RulesSection } from "../shared/rules";
import type { ArtifactBase, Layer } from "../shared";
import type { FormField } from "./field";
import type { FormAnnex } from "./annex";
import type { FormParty } from "./party";

/**
 * Form artifact definition including fields, optional layers, annexes, and party roles.
 * Forms are interactive artifacts that capture user input and can be signed by parties.
 */
export interface Form extends ArtifactBase {
  /** Literal `"form"` discriminator. */
  kind: "form";
  /** Named definitions that can be referenced in field/annex conditions. */
  defs?: DefsSection;
  /** Form-level validation rules for cross-field constraints. */
  rules?: RulesSection;
  /** Field definitions keyed by identifier. */
  fields?: Record<string, FormField>;
  /** Named layers for rendering this form into different formats. */
  layers?: Record<string, Layer>;
  /** Key of the default layer to use when none specified. */
  defaultLayer?: string;
  /** Whether additional ad-hoc annexes can be attached beyond those defined in the annexes record. */
  allowAdditionalAnnexes?: boolean;
  /** Predefined annex slots keyed by identifier. */
  annexes?: Record<string, FormAnnex>;
  /** Party role definitions keyed by role identifier, with constraints and signature requirements. */
  parties?: Record<string, FormParty>;
}

// Re-export all form-related types
export type {
  BaseField,
  FieldsetField,
  FormField,
  TextField,
  BooleanField,
  NumberField,
  CoordinateField,
  BboxField,
  MoneyField,
  AddressField,
  PhoneField,
  DurationField,
  EmailField,
  UuidField,
  UriField,
  EnumField,
  DateField,
  DatetimeField,
  TimeField,
  PersonField,
  OrganizationField,
  IdentificationField,
  MultiselectField,
  PercentageField,
  RatingField,
} from "./field";

export type { FormFieldset } from "./fieldset";
export type { FormAnnex } from "./annex";
export type { FormParty, FormSignature } from "./party";
