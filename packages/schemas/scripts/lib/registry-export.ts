/**
 * Shared helpers for the registry-based export scripts: the root bundle
 * (`export-root-schema-zod.ts`), the CLI registry schemas
 * (`export-registry-schemas-zod.ts`), and the manifest schema
 * (`export-manifest-schema-zod.ts`).
 *
 * Each of those scripts pulls one or more named schemas out of a Zod global
 * registry via `z.toJSONSchema(registry)`, which returns every registered
 * schema keyed by name, with bare-name `$ref`s between them (e.g. `"Layer"`,
 * not `"#/$defs/Layer"`). These helpers turn that into a proper JSON Schema
 * `$defs` map addressed by `#/$defs/<Name>` pointers.
 */

export type JsonSchemaMap = Record<string, Record<string, unknown>>;

/** Rewrite every bare-name `$ref` in `obj` that names a known def to a JSON Pointer. */
export function transformRefsToPointer(obj: unknown, knownDefs: Set<string>): unknown {
	if (typeof obj !== 'object' || obj === null) return obj;
	if (Array.isArray(obj)) return obj.map((item) => transformRefsToPointer(item, knownDefs));

	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		if (key === '$ref' && typeof value === 'string' && knownDefs.has(value)) {
			result[key] = `#/$defs/${value}`;
		} else {
			result[key] = transformRefsToPointer(value, knownDefs);
		}
	}
	return result;
}

/** Strip a def's per-schema `$schema`/`$id`/`id` metadata and pointer-ize its `$ref`s. */
export function cleanDef(schema: Record<string, unknown>, knownDefs: Set<string>): Record<string, unknown> {
	const { $schema, $id, id, ...rest } = schema;
	return transformRefsToPointer(rest, knownDefs) as Record<string, unknown>;
}

/** Collect every def name transitively `$ref`-reachable from `root`, in discovery order. */
export function collectReferencedDefs(
	root: unknown,
	schemas: JsonSchemaMap,
	knownDefs: Set<string>,
	referenced: Set<string> = new Set(),
): Set<string> {
	if (typeof root !== 'object' || root === null) return referenced;
	if (Array.isArray(root)) {
		for (const item of root) collectReferencedDefs(item, schemas, knownDefs, referenced);
		return referenced;
	}
	for (const [key, value] of Object.entries(root)) {
		if (key === '$ref' && typeof value === 'string' && knownDefs.has(value)) {
			if (!referenced.has(value)) {
				referenced.add(value);
				const refSchema = schemas[value];
				if (refSchema) collectReferencedDefs(refSchema, schemas, knownDefs, referenced);
			}
		} else {
			collectReferencedDefs(value, schemas, knownDefs, referenced);
		}
	}
	return referenced;
}

/** Build a `$defs` map from a set of referenced def names. */
export function buildDefs(names: Iterable<string>, schemas: JsonSchemaMap, knownDefs: Set<string>): JsonSchemaMap {
	const defs: JsonSchemaMap = {};
	for (const name of names) {
		const schema = schemas[name];
		if (schema) defs[name] = cleanDef(schema, knownDefs);
	}
	return defs;
}

/**
 * Clean one registered schema for publication as a document's top level,
 * plus the `$defs` map of every schema it transitively references.
 */
export function extractRegistryEntry(
	mainSchema: Record<string, unknown>,
	schemas: JsonSchemaMap,
	knownDefs: Set<string>,
): { main: Record<string, unknown>; defs: JsonSchemaMap } {
	const referenced = collectReferencedDefs(mainSchema, schemas, knownDefs);
	return {
		main: cleanDef(mainSchema, knownDefs),
		defs: buildDefs(referenced, schemas, knownDefs),
	};
}
