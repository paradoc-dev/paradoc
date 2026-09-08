// ============================================================================
// ARTIFACTS (Design-time + Runtime)
// ============================================================================

export {
  // Form
  FormValidationError,
  FormRuleViolationError,
  SealConfigError,
  buildSlotPlan,
  compileLegacySignatureSlots,
  form,
  field,
  textField,
  booleanField,
  numberField,
  coordinateField,
  bboxField,
  moneyField,
  addressField,
  phoneField,
  durationField,
  emailField,
  uuidField,
  uriField,
  enumField,
  dateField,
  datetimeField,
  timeField,
  personField,
  organizationField,
  identificationField,
  multiselectField,
  percentageField,
  ratingField,
  fieldsetField,
  listField,
  annex,
  party,
  // Checklist
  checklist,
  ChecklistValidationError,
  // Document
  document,
  // Bundle
  bundle,
  // Shared
  layer,
  fileLayer,
  inlineLayer,
  // Serialization helpers
  runtimeFormFromJSON,
  runtimeDocumentFromJSON,
  runtimeChecklistFromJSON,
  runtimeBundleFromJSON,
  assertBundleInclusionResolved,
  decisionForKey,
  evaluateBundleInclusion,
  includedRuntimeContents,
  // Shared utilities
  withArtifactMethods,
  renderLayer,
  resolveLayerKey,
  resolveAndRenderLayer,
  UnboundResolverError,
  // Unified namespace
  para,
} from "./artifacts";

export type {
  // Form types
  FormInstance,
  RuntimeForm,
  DraftForm,
	SafeFillResult,
  FormValidationResult,
  SignableForm,
  ExecutedForm,
  FormInput,
  RuntimeFormJSON,
  InferFormPayload,
  ProgressiveFormPayload,
  FormPath,
  ExtractFields,
  FieldKeys,
  PartyRoleKeys,
  CaptureOptions,
  SealOptions,
  // Document types
  DocumentInstance,
  RuntimeDocument,
  DraftDocument,
  FinalDocument,
  DocumentInput,
  RuntimeDocumentJSON,
  // Checklist types
  ChecklistInstance,
  RuntimeChecklist,
  DraftChecklist,
  CompletedChecklist,
  ChecklistInput,
  RuntimeChecklistJSON,
  InferChecklistPayload,
  ProgressiveChecklistPayload,
  ChecklistPath,
	ChecklistFillOptions,
  ChecklistUpdateOptions,
  ChecklistValidationResult,
  ChecklistFillTarget,
  ChecklistFillItemState,
  ChecklistFillState,
  ItemStatusToDataType,
  ItemsToDataType,
  // Bundle types
  BundleInstance,
  RuntimeBundle,
  DraftBundle,
  SignableBundle,
  ExecutedBundle,
  BundleInput,
  RuntimeBundleJSON,
  RuntimeInstance,
  RuntimeBundleContents,
  RuntimeBundleRenderOptions,
  RuntimeBundleRenderedOutput,
  RuntimeBundleRendered,
  BundleBytesMember,
  BundleEvaluationMember,
  BundleInclusionDecision,
  BundleInclusionState,
  BundleInclusionStatus,
  BundleRuntimeMember,
  // Shared types
  ArtifactMethods,
  ArtifactInstanceOptions,
  ArtifactLayerRenderOptions,
  LayerRenderOptions,
  ResolverBindingSite,
  RuntimeAsOfInput,
  RuntimeContext,
  RuntimeContextOptions,
  RuntimeCreationOptions,
  // Builder types
  FieldAPI,
  TextFieldBuilder,
  BooleanFieldBuilder,
  NumberFieldBuilder,
  CoordinateFieldBuilder,
  BboxFieldBuilder,
  MoneyFieldBuilder,
  AddressFieldBuilder,
  PhoneFieldBuilder,
  DurationFieldBuilder,
  EmailFieldBuilder,
  UuidFieldBuilder,
  UriFieldBuilder,
  EnumFieldBuilder,
  DateFieldBuilder,
  DatetimeFieldBuilder,
  TimeFieldBuilder,
  PersonFieldBuilder,
  OrganizationFieldBuilder,
  IdentificationFieldBuilder,
  MultiselectFieldBuilder,
  PercentageFieldBuilder,
  RatingFieldBuilder,
  FieldsetFieldBuilder,
  ListFieldBuilder,
  PartyAPI,
  PartyBuilder,
  LayerAPI,
  FileLayerBuilderType,
  InlineLayerBuilderType,
  LayerBuilderType,
  AnnexAPI,
  AnnexBuilder,
  Paradoc,
} from "./artifacts";

// ============================================================================
// PRIMITIVES
// ============================================================================

export {
  address,
  attachment,
  bbox,
  coordinate,
  date,
  datetime,
  duration,
  identification,
  metadata,
  money,
  organization,
  partyData,
  percentage,
  person,
  phone,
  rating,
  signature,
  time,
} from "./primitives";

// ============================================================================
// RENDERING
// ============================================================================

export { assembleBundle, isAssemblyBytesEntry, producedMimeType, sealBundle } from "./rendering";

export { BundleSealError } from "./rendering";

export {
  InlineReactLayerError,
  isReactLayerMimeType,
  reactLayersOf,
  REACT_LAYER_MIME_TYPES,
  REACT_LAYER_RULE,
  UnregisteredLayerRendererError,
} from "./rendering";

export type {
  ReactLayerEntry,
  RendererRegistry,
  AssemblyBytesEntry,
  AssemblyContentEntry,
  BundleAssemblyOptions,
  AssembledBundleOutput,
  AssembledBundle,
  BundleSealOptions,
  PacketPart,
  PacketPartKind,
  PacketSigner,
  PacketSigningField,
  SealedBundle,
} from "./rendering";

// ============================================================================
// VALIDATION
// ============================================================================

export {
  // Type guards
  isForm,
  isDocument,
  isBundle,
  isChecklist,
  isFormField,
  isFormAnnex,
  isFormParty,
  isLayer,
  isParty,
  isSignature,
  isAttachment,
  isAddress,
  isBbox,
  isCoordinate,
  isDuration,
  isIdentification,
  isMetadata,
  isMoney,
  isOrganization,
  isPerson,
  isPhone,
  // Validators
  validateForm,
  validateFormData,
  validateFieldInput,
  validateFieldsPatch,
  validatePartyInput,
  validatePartiesPatch,
  validateAnnexInput,
  validateAnnexesPatch,
  validateChecklistItemInput,
  validateChecklistItemsPatch,
  validateDocument,
  validateBundle,
  validateChecklist,
  validateFormField,
  validateFormAnnex,
  validateFormParty,
  validateLayer,
  validateChecklistItem,
  validateBundleContentItem,
  validateSignature,
  validateAttachment,
  validateAddress,
  validateBbox,
  validateCoordinate,
  validateDuration,
  validateIdentification,
  validateMetadata,
  validateMoney,
  validateOrganization,
  validatePerson,
  validatePhone,
  // Party validation
  validatePartyForRole,
  isPartyTypeAllowed,
  inferPartyType,
  expectsArrayFormat,
  validatePartyId,
  validatePartiesForRole,
  // Artifact validation
  validateArtifact,
  parseArtifact,
} from "./validation";

export type {
  ValidationError,
  ValidationSuccess,
  ValidationFailure,
  ValidationResult,
  ValidateOptions,
  PartyValidationResult,
  ExtendedValidationResult,
  ProgressiveValidationResult,
  FieldInputValidationInput,
  PartyInputValidationInput,
  AnnexInputValidationInput,
  ChecklistItemInputValidationInput,
  NormalizedPartyInput,
} from "./validation";

// ============================================================================
// INFERENCE (Type utilities)
// ============================================================================

export type {
  JsonSchema,
  FieldToDataType,
  FieldsToDataType,
  InferFormData,
  DeepPartial,
  CompositePropertySpec,
  CompositeShape,
  // InferFormPayload is already exported from ./artifacts
} from "./inference";

export {
  compile,
  compileToJsonSchema,
  CANONICAL_SHAPES,
  isCompositeType,
  describeCompositeShape,
} from "./inference";

// ============================================================================
// SERIALIZATION
// ============================================================================

export * from "./serialization";

// ============================================================================
// CONSTANTS
// ============================================================================

export { PARADOC_SCHEMA_URL } from "@paradoc/schemas";

// ============================================================================
// FILL STATE (Progressive Filling)
// ============================================================================

export {
  buildDependencyMap,
  computeFillState,
  computeRuntimeState,
  getAvailableFillTargets,
  getNextFillTarget,
} from "./fill-state";

export type {
	FillOptions,
  UpdateOptions,
  FillTargetOptions,
  FillTargetKind,
  FillTarget,
  FillItemState,
  FillState,
} from "./fill-state";

// ============================================================================
// LOGIC
// ============================================================================

export * from "./logic";

// The expression engine (parser, evaluator, type checker, exact decimal) is
// surfaced under the `expr` namespace. Namespaced rather than flat-re-exported
// because @paradoc/expr and core's own logic surface share names (e.g.
// EvaluationContext); a flat `export *` would silently drop the collisions.
export * as expr from "@paradoc/expr";

// ============================================================================
// SCHEMAS (Type re-exports from @paradoc/types)
// ============================================================================

// Artifact types
export type {
  ArtifactBase,
  Form,
  Document,
  Checklist,
  ChecklistItem,
  StatusSpec,
  EnumStatusOption,
  Bundle,
  BundleContentItem,
  Layer,
  InlineLayer,
  FileLayer,
  // Validation rules
  ValidationRule,
  RulesSection,
  RuleSeverity,
} from "@paradoc/types";

// Block types (fields, fieldsets, annexes, parties)
export type {
  FormField,
  FieldsetField,
  ListField,
  TextField,
  NumberField,
  BooleanField,
  EnumField,
  EmailField,
  UriField,
  UuidField,
  AddressField,
  PhoneField,
  CoordinateField,
  BboxField,
  MoneyField,
  DurationField,
  FormAnnex,
  Party,
  Bindings,
} from "@paradoc/types";

// Primitive types
export type {
  Coordinate,
  Address,
  Phone,
  Money,
  Duration,
  Person,
  Organization,
  Identification,
  Bbox,
  Metadata,
} from "@paradoc/types";

// Artifact union type and kind
export type { Artifact } from "@paradoc/types";
export type ArtifactKind = "form" | "document" | "checklist" | "bundle";

// ============================================================================
// LOAD
// ============================================================================

export {
  load,
  safeLoad,
  loadFromObject,
  safeLoadFromObject,
  BundleResolverError,
  LoadError,
  // Type guards for artifact discrimination
  isFormInstance,
  isDocumentInstance,
  isBundleInstance,
  isChecklistInstance,
} from "./serialization";

export type { AnyArtifactInstance } from "./serialization";

// ============================================================================
// TYPES
// ============================================================================

export type {
  SerializationFormat,
  SerializationOptions,
  RenderOptions,
  RuntimeFormRenderOptions,
  RuntimeChecklistRenderOptions,
	InstanceTemplate,
} from "./types";

// Re-export from @paradoc/types
export type {
  ChecklistData,
} from "@paradoc/types";

// Re-export sealing types from @paradoc/types
export type {
  SigningFieldType,
  SigningField,
  SealingRequest,
  SealingResult,
  SealAdapterDocument,
  SealAdapterRequest,
  SealAdapterResult,
  SealAdapter,
  AnchorLocateQuery,
  LocateHit,
  SealLocator,
  Sealer,
  // Legacy aliases (deprecated)
  FormalSigningRequest,
  FormalSigningResponse,
  FormalSigningAdapter,
} from "@paradoc/types";

// ============================================================================
// UTILITIES
// ============================================================================

export { validateArtifact as validate } from "./validation";
export { parse } from "./serialization";

// ============================================================================
// SECURITY
// ============================================================================

export {
  assertSafePattern,
  isSafePattern,
  createSafeRegex,
  UnsafePatternError,
} from "./utils/safe-pattern";

// ============================================================================
// CODEGEN
// ============================================================================

export { jsonToDts, jsonToTsModule, jsonToLiteralType } from "./codegen";
export type { JsonToTsModuleOptions } from "./codegen";
