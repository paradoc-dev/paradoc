/**
 * @paradoc/ui-catalog
 *
 * Headless catalog of input UI primitives for Paradoc artifacts.
 * See README.md for usage.
 */

// Catalog (Zod prop schemas + runtime registry)
export {
	CATALOG,
	CATALOG_COMPONENT_NAMES,
	optionSchema,
	validateProps,
} from "./catalog.js";
export type { CatalogComponentName, CatalogOption } from "./catalog.js";

// Spec node shape
export type { SpecNode, StateBinding, StateRead } from "./spec.js";

// Mapper
export { fieldToSpec } from "./mapper.js";
export type { MapperContext, TranslateOptionInput } from "./mapper.js";

// Action types
export {
	CATALOG_ACTION_TYPES,
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
