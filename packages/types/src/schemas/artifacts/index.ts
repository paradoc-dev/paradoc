/**
 * Artifact types for Paradoc
 * Includes Document, Form, Checklist, and Bundle artifacts
 */

// Shared types
export type {
  ArtifactBase,
  InlineContentRef,
  FileContentRef,
  ContentRef,
  SignatureBlockType,
  SignatureBlock,
  Layer,
  InlineLayer,
  FileLayer,
  Bindings,
  CondExpr,
  // Expression types
  BaseExpression,
  BooleanExpression,
  StringExpression,
  NumberExpression,
  IntegerExpression,
  PercentageExpression,
  RatingExpression,
  DateExpression,
  TimeExpression,
  DatetimeExpression,
  DurationExpression,
  MoneyExpressionValue,
  AddressExpressionValue,
  PhoneExpressionValue,
  CoordinateExpressionValue,
  BboxExpressionValue,
  PersonExpressionValue,
  OrganizationExpressionValue,
  IdentificationExpressionValue,
  MoneyExpression,
  AddressExpression,
  PhoneExpression,
  CoordinateExpression,
  BboxExpression,
  PersonExpression,
  OrganizationExpression,
  IdentificationExpression,
  ScalarExpression,
  ObjectExpression,
  Expression,
  ScalarExpressionType,
  ObjectExpressionType,
  ExpressionType,
  DefsSection,
  // Rules types
  RuleSeverity,
  ValidationRule,
  RulesSection,
} from "./shared";

// Document artifact
export type { Document } from "./document";

// Checklist artifact
export type {
  BooleanStatusSpec,
  EnumStatusOption,
  EnumStatusSpec,
  StatusSpec,
  ChecklistItem,
  Checklist,
} from "./checklist";

// Bundle artifact
export type {
  BundleContentItem,
  InlineBundleItem,
  PathBundleItem,
  RegistryBundleItem,
  Bundle,
} from "./bundle";

// Form artifact and related types
export type {
  // Form type
  Form,
  // Field types
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
  // Fieldset
  FormFieldset,
  // Annex
  FormAnnex,
  // Party
  FormParty,
  // Signature
  FormSignature,
} from "./form";

// Union types
export type { Artifact } from "./unions";
