/**
 * Action types emitted by catalog components when the user interacts.
 *
 * Consumers register handlers for these action types in their renderer.
 * The action payload tells the host what happened and (for submission)
 * which artifact field path the value belongs to.
 */

/**
 * The user submitted a value for a specific field.
 *
 * `value` is the canonical value (e.g. canonical English enum keys, not
 * the localized labels the user saw). The component is responsible for
 * mapping localized inputs back to canonical values before emitting.
 */
export type SubmitFieldValueAction = {
	type: "submitFieldValue";
	fieldPath: string;
	value: unknown;
};

/**
 * The user dismissed/cancelled a rendered input without submitting.
 * Useful when the agent should retract the question or move on.
 */
export type CancelFieldAction = {
	type: "cancelField";
	fieldPath: string;
};

/**
 * The user wants to edit a previously-filled field. Triggered from
 * summary cards or "edit" affordances. Host should re-emit the input
 * spec with the current value as the default.
 */
export type EditFilledFieldAction = {
	type: "editFilledField";
	fieldPath: string;
};

/** Discriminated union of all catalog actions. */
export type CatalogAction =
	| SubmitFieldValueAction
	| CancelFieldAction
	| EditFilledFieldAction;

/** All catalog action `type` strings. */
export const CATALOG_ACTION_TYPES = [
	"submitFieldValue",
	"cancelField",
	"editFilledField",
] as const;

export type CatalogActionType = (typeof CATALOG_ACTION_TYPES)[number];
