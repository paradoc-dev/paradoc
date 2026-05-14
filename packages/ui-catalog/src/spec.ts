/**
 * Spec node shape produced by the catalog mapper.
 *
 * Compatible with json-render's spec format. Consumers feed these to a
 * <Renderer> that knows how to map each `type` (catalog component name)
 * to an actual UI component, and dispatch the attached actions.
 */

import type { CatalogComponentName } from "./catalog.js";

/**
 * A binding directive pointing to a state path. The renderer wires the
 * referenced prop to the named state slot for two-way binding.
 */
export type StateBinding = { $bindState: string };

/**
 * State read directive — reads from state without writing back.
 */
export type StateRead = { $state: string };

/**
 * A spec node describes one component instance the renderer should produce.
 *
 * - `type`: the catalog component name (e.g. "TextInput", "EnumPicker")
 * - `props`: free-form props validated by the catalog Zod schema for the
 *   given `type`. Inline binding directives (like `{$state: "/foo"}`) are
 *   permitted in any prop position.
 * - `fieldPath`: optional. When set, the registry component should treat
 *   submissions as targeting this artifact field. Carried through to the
 *   `submitFieldValue` action so the consumer knows where the value belongs.
 * - `bindings`: optional. State bindings for component values (e.g.
 *   `{ value: { $bindState: "/name" } }`).
 * - `children`: optional. For container components (e.g. `Fieldset`).
 */
export type SpecNode = {
	type: CatalogComponentName;
	props?: Record<string, unknown>;
	fieldPath?: string;
	bindings?: Record<string, StateBinding | StateRead>;
	children?: SpecNode[];
};
