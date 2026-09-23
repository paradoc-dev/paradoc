import { SCHEMA_VERSION, SCHEMA_VERSIONS } from "@paradoc/schemas";

/**
 * Schema version tokens for docs content.
 *
 * Docs pages never hand-write a schema version. A code block or inline code
 * span writes one of these tokens instead, and `remarkSchemaVersion` fills in
 * the value from `@paradoc/schemas` at build time, so a schema version bump
 * updates every page. The tokens work only inside code: in prose, markdown
 * reads `__…__` as bold text.
 */
export const SCHEMA_VERSION_TOKEN = "__SCHEMA_VERSION__";

/** The version before the current one, for pages that show an older file. */
export const PREVIOUS_SCHEMA_VERSION_TOKEN = "__PREVIOUS_SCHEMA_VERSION__";

function previousSchemaVersion(): string {
	const version = SCHEMA_VERSIONS.at(-2);
	if (!version) {
		throw new Error(
			"@paradoc/schemas publishes no version before the current one",
		);
	}
	return version;
}

const PREVIOUS_SCHEMA_VERSION = previousSchemaVersion();

/** Replace every schema version token in `text` with its version. */
export function fillSchemaVersion(text: string): string {
	return text
		.replaceAll(PREVIOUS_SCHEMA_VERSION_TOKEN, PREVIOUS_SCHEMA_VERSION)
		.replaceAll(SCHEMA_VERSION_TOKEN, SCHEMA_VERSION);
}

interface MdastNode {
	type: string;
	value?: unknown;
	children?: MdastNode[];
}

function fillNode(node: MdastNode): void {
	if (
		(node.type === "code" || node.type === "inlineCode") &&
		typeof node.value === "string"
	) {
		node.value = fillSchemaVersion(node.value);
	}
	for (const child of node.children ?? []) fillNode(child);
}

/** Remark plugin: fill schema version tokens in code blocks and inline code. */
export function remarkSchemaVersion() {
	return (tree: MdastNode) => fillNode(tree);
}
