/**
 * Shared types used across multiple artifact types
 */

export type { ArtifactBase } from "./base";
export type { InlineContentRef, FileContentRef, ContentRef } from "./content-ref";
export type { SignatureBlockType, SignatureBlock, InlineLayer, FileLayer, Layer, Bindings } from "./layer";
export type {
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
} from "./expressions";
export type {
  RuleSeverity,
  ValidationRule,
  RulesSection,
} from "./rules";
