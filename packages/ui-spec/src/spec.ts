/**
 * Public presentation contract for the catalog.
 *
 * A spec is deliberately smaller than an application UI description. It is a
 * typed tree of catalog components and their props. The host owns state,
 * visibility and submission; a spec only identifies the component to render
 * and, when it is bound, the host field it presents.
 */

import { z } from "zod";
import {
	CATALOG,
	CATALOG_COMPONENT_NAMES,
	type CatalogComponentName,
	type CatalogPropsFor,
} from "./catalog.js";

/** A host field address carried by a presentation node. */
export type FieldPath = string;

/** A reusable field template address, for example `items[].name`. */
export type TemplateFieldPath = FieldPath;

/** A concrete field address, for example `items[2].name`. */
export type ConcreteFieldPath = FieldPath;

/**
 * The address state of a presentation node.
 *
 * These states are kept explicit at the presentation boundary. In
 * particular, a reusable list template is not a target that can receive an
 * answer, and omitted context remains unbound rather than becoming a made-up
 * root path.
 */
export type FieldTarget =
	| { kind: "unbound" }
	| { kind: "template"; path: TemplateFieldPath }
	| { kind: "concrete"; path: ConcreteFieldPath };

type SpecPropsFor<TName extends CatalogComponentName> = CatalogPropsFor<TName>;

/** A scalar node has no child collection. */
type ScalarSpecNode<TName extends CatalogComponentName> = {
	type: TName;
	props: SpecPropsFor<TName>;
	fieldPath?: FieldPath;
	children?: never;
};

/** A fieldset owns a recursive collection of independently addressed nodes. */
export type FieldsetSpecNode = {
	type: "Fieldset";
	props: SpecPropsFor<"Fieldset">;
	fieldPath?: FieldPath;
	children: SpecNode[];
};

/** A list owns exactly one reusable child template. */
export type ListSpecNode = {
	type: "List";
	props: SpecPropsFor<"List">;
	fieldPath?: FieldPath;
	children: [SpecNode];
};

/** A node whose props and children are narrowed by its component identity. */
export type SpecNodeFor<TName extends CatalogComponentName> = TName extends "Fieldset"
	? FieldsetSpecNode
	: TName extends "List"
		? ListSpecNode
		: ScalarSpecNode<TName>;

/** Complete typed component tree emitted and consumed by the UI spec package. */
export type SpecNode = {
	[TName in CatalogComponentName]: SpecNodeFor<TName>;
}[CatalogComponentName];

const catalogNameValues = CATALOG_COMPONENT_NAMES as [
	CatalogComponentName,
	...CatalogComponentName[],
];

const fieldPathSchema = z.string().min(1, "fieldPath must not be empty");

/**
 * The raw recursive shape is intentionally closed. Its refinement dispatches
 * `props` to the component schema, retaining useful paths such as
 * `children[0].props.default` in malformed serialized specs.
 */
const specNodeSchema: z.ZodType<unknown> = z.lazy(() => nodeObjectSchema);
const nodeObjectSchema = z
	.object({
		type: z.enum(catalogNameValues),
		props: z.record(z.string(), z.unknown()),
		fieldPath: fieldPathSchema.optional(),
		children: z.array(specNodeSchema).optional(),
	})
	.strict()
	.superRefine((node, ctx) => {
		const component = CATALOG[node.type];
		if (!component) return;
		const props = component.props.safeParse(node.props);
		if (!props.success) {
			for (const issue of props.error.issues) {
				const issuePaths =
					issue.code === "unrecognized_keys"
						? issue.keys.map((key) => ["props", ...issue.path, key])
						: [["props", ...issue.path]];
				for (const path of issuePaths) {
					ctx.addIssue({
						code: "custom",
						path,
						message: `${node.type} props: ${issue.message}`,
					});
				}
			}
		}

		if (node.type === "Fieldset") {
			if (node.children === undefined) {
				ctx.addIssue({
					code: "custom",
					path: ["children"],
					message: "Fieldset requires a children array",
				});
			}
			return;
		}

		if (node.type === "List") {
			if (node.children === undefined) {
				ctx.addIssue({
					code: "custom",
					path: ["children"],
					message: "List requires exactly one child template",
				});
			} else if (node.children.length !== 1) {
				ctx.addIssue({
					code: "custom",
					path: ["children"],
					message: "List requires exactly one child template",
				});
			}
			return;
		}

		if (node.children !== undefined) {
			ctx.addIssue({
				code: "custom",
				path: ["children"],
				message: `${node.type} cannot have children`,
			});
		}
	});

/** Runtime schema for a complete serialized presentation tree. */
export const SpecNodeSchema = specNodeSchema as z.ZodType<SpecNode>;

function isTemplateSyntax(path: string): boolean {
	// `*` is recognized only to report the old wildcard shape as a template;
	// it is never converted into a concrete address.
	return path.includes("[]") || path.includes("*");
}

/** Classify an optional host address without inventing a root path. */
export function classifyFieldTarget(fieldPath?: string): FieldTarget {
	if (fieldPath === undefined || fieldPath === "") return { kind: "unbound" };
	if (isTemplateSyntax(fieldPath)) return { kind: "template", path: fieldPath };
	return { kind: "concrete", path: fieldPath };
}

/** Return true when an address names a reusable template rather than an item. */
export function isTemplateFieldPath(fieldPath?: string): fieldPath is TemplateFieldPath {
	return classifyFieldTarget(fieldPath).kind === "template";
}

/** Return true when an address is a concrete host target. */
export function isConcreteFieldPath(fieldPath?: string): fieldPath is ConcreteFieldPath {
	return classifyFieldTarget(fieldPath).kind === "concrete";
}

/**
 * Require a concrete target for an action. This keeps omitted binding context
 * and reusable templates distinguishable at the host boundary.
 */
export function assertConcreteFieldPath(fieldPath?: string): ConcreteFieldPath {
	const target = classifyFieldTarget(fieldPath);
	if (target.kind === "unbound") {
		throw new Error("Cannot submit an unbound presentation node");
	}
	if (target.kind === "template") {
		throw new Error(`Cannot submit reusable field template: ${target.path}`);
	}
	return target.path;
}

/**
 * Resolve a template against concrete list item indices supplied by a host.
 * A host that has no repeated-target capability must reject before calling
 * this helper; no fallback path is fabricated here.
 */
export function resolveConcreteFieldPath(
	templatePath: string,
	indices: readonly number[],
): ConcreteFieldPath {
	const target = classifyFieldTarget(templatePath);
	if (target.kind === "unbound") {
		throw new Error("Cannot resolve an unbound presentation node");
	}
	if (target.kind === "concrete") {
		if (indices.length > 0) {
			throw new Error(`Field path is already concrete: ${target.path}`);
		}
		return target.path;
	}
	if (target.path.includes("*")) {
		throw new Error(`Unsupported wildcard field template: ${target.path}`);
	}

	let index = 0;
	const resolved = target.path.replace(/\[\]/g, () => {
		const itemIndex = indices[index++];
		if (itemIndex === undefined || !Number.isInteger(itemIndex) || itemIndex < 0) {
			throw new Error(`Missing concrete list index for field template: ${target.path}`);
		}
		return `[${itemIndex}]`;
	});
	if (index !== indices.length) {
		throw new Error(`Too many concrete list indices for field template: ${target.path}`);
	}
	return resolved;
}

function validateTemplateTargets(
	node: SpecNode,
	inherited: "unbound" | "template" | "concrete",
	path: (string | number)[],
	issues: z.ZodIssue[],
): void {
	const target = classifyFieldTarget(node.fieldPath);
	if (inherited === "unbound" && target.kind !== "unbound") {
		issues.push({
			code: "custom",
			path: [...path, "fieldPath"],
			message: "Unbound descendants must remain unbound",
		});
	}
	if (inherited === "template" && target.kind === "concrete") {
		issues.push({
			code: "custom",
			path: [...path, "fieldPath"],
			message: "Reusable list descendants must retain template addressing",
		});
	}

	const childContext =
		node.type === "List"
			? target.kind === "unbound"
				? "unbound"
				: "template"
			: inherited === "unbound" || target.kind === "unbound"
				? "unbound"
				: target.kind;
	const children = "children" in node ? node.children : undefined;
	for (const [index, child] of (children ?? []).entries()) {
		validateTemplateTargets(child, childContext, [...path, "children", index], issues);
	}
}

/**
 * Validate a complete spec at the serialized-consumption boundary.
 * Component props are parsed with their source schemas, while node shape and
 * recursive address rules are checked here so malformed input cannot be
 * silently stripped or turn into a runtime TypeError.
 */
export function validateSpec(input: unknown): SpecNode {
	const node = SpecNodeSchema.parse(input);
	const issues: z.ZodIssue[] = [];
	validateTemplateTargets(node, classifyFieldTarget(node.fieldPath).kind, [], issues);
	if (issues.length > 0) throw new z.ZodError(issues);
	return normalizeSpecNode(node);
}

function normalizeSpecNode(node: SpecNode): SpecNode {
	const props = CATALOG[node.type].props.parse(node.props);
	if (node.type === "Fieldset") {
		return {
			...node,
			props,
			children: node.children.map(normalizeSpecNode),
		};
	}
	if (node.type === "List") {
		return {
			...node,
			props,
			children: [normalizeSpecNode(node.children[0])],
		};
	}
	return { ...node, props } as SpecNode;
}
