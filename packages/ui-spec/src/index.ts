/**
 * @paradoc/ui-spec
 *
 * Headless UI specification for Paradoc artifacts.
 * See README.md for usage.
 */

// Catalog (Zod prop schemas + runtime registry)
export {
	CATALOG,
	CATALOG_COMPONENT_NAMES,
	optionSchema,
	validateProps,
} from "./catalog.js";
export type {
	CatalogComponentName,
	CatalogOption,
	CatalogProps,
	CatalogPropsFor,
} from "./catalog.js";

// Typed spec tree, validation, and field target helpers
export {
	SpecNodeSchema,
	validateSpec,
	classifyFieldTarget,
	isTemplateFieldPath,
	isConcreteFieldPath,
	assertConcreteFieldPath,
	resolveConcreteFieldPath,
} from "./spec.js";
export type {
	SpecNode,
	SpecNodeFor,
	FieldsetSpecNode,
	ListSpecNode,
	FieldPath,
	TemplateFieldPath,
	ConcreteFieldPath,
	FieldTarget,
} from "./spec.js";

// Mapper
export { fieldToSpec } from "./mapper.js";
export type { MapperContext, TranslateOptionInput } from "./mapper.js";

// Action types
export {
	CATALOG_ACTION_TYPES,
	createSubmitFieldValueAction,
} from "./actions.js";
export type {
	SubmitFieldValueAction,
	DeferFieldAction,
	SkipFieldAction,
	DismissFieldAction,
	EditFilledFieldAction,
	CatalogAction,
	CatalogActionType,
} from "./actions.js";

// Re-export the FormField type from @paradoc/types so consumers don't
// need to also depend on @paradoc/types just to call the mapper.
export type { FormField } from "@paradoc/types";
