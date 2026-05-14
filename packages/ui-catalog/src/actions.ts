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
 * The user wants to defer this field — come back to it later. Valid for both
 * required and optional fields. Hosts should record this as a "deferred"
 * state and offer to revisit after other fields are answered.
 */
export type DeferFieldAction = {
	type: "deferField";
	fieldPath: string;
	note?: string;
};

/**
 * The user wants to skip this field altogether — they're opting out of
 * answering. Only valid for optional fields; required fields can only be
 * deferred. Hosts that receive a skip for a required field should reject.
 */
export type SkipFieldAction = {
	type: "skipField";
	fieldPath: string;
	note?: string;
};

/**
 * The user dismissed the rendered input without submitting, defer, or skip.
 * UI-only — the host should hide the input but not record any backend state
 * change. Typical use: user wants to type the answer naturally in the chat.
 */
export type DismissFieldAction = {
	type: "dismissField";
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
	| DeferFieldAction
	| SkipFieldAction
	| DismissFieldAction
	| EditFilledFieldAction;

/** All catalog action `type` strings. */
export const CATALOG_ACTION_TYPES = [
	"submitFieldValue",
	"deferField",
	"skipField",
	"dismissField",
	"editFilledField",
] as const;

export type CatalogActionType = (typeof CATALOG_ACTION_TYPES)[number];
