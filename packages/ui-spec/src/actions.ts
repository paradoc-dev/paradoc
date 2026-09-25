/**
 * Action types emitted by catalog components when the user interacts.
 *
 * Consumers register handlers for these action types in their renderer.
 * The action payload tells the host what happened and (for submission)
 * which artifact field path the value belongs to.
 */

import { assertConcreteFieldPath } from "./spec.js";

/**
 * The user submitted a value for a specific field.
 *
 * `value` is the canonical field value (e.g. enum option values, not the
 * localized labels the user saw). The component is responsible for
 * mapping localized inputs back to canonical values before emitting.
 */
export type SubmitFieldValueAction = {
	type: "submitFieldValue";
	fieldPath: string;
	value: unknown;
};

/**
 * Construct a submission action only for a concrete host target. Consumers
 * should use this at the renderer boundary so templates and unbound nodes are
 * rejected before an action reaches a session adapter.
 */
export function createSubmitFieldValueAction(
	fieldPath: string | undefined,
	value: unknown,
): SubmitFieldValueAction {
	return {
		type: "submitFieldValue",
		fieldPath: assertConcreteFieldPath(fieldPath),
		value,
	};
}
