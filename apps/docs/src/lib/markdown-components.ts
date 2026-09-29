/**
 * Markdown forms of the MDX components used in docs content.
 *
 * `source.config.ts` passes `stringifyMdxComponent` to fumadocs' processed
 * Markdown output. Each component the docs use becomes plain Markdown here, so
 * the Markdown a reader or agent gets carries the same content as the page.
 * A component with no Markdown form fails the build instead of shipping as a
 * placeholder. The registry-backed component-doc elements are the exception:
 * they need the built registry, so `expandComponentMarkdown` resolves them when
 * a page is served.
 */

/** Elements expanded from the built registry when a page is served. */
const RUNTIME_EXPANDED_COMPONENTS: readonly string[] = [
  "ComponentInstallation",
  "ComponentPreview",
  "ComponentUsage",
  "ComponentVariant",
  "BlockUsage",
];

interface EstreeNode {
  type: string;
  [key: string]: unknown;
}

interface JsxAttribute {
  type: string;
  name?: string;
  value?: string | { value?: string; data?: { estree?: { body?: EstreeNode[] } } } | null;
}

interface JsxElement {
  type: string;
  name?: string | null;
  attributes?: JsxAttribute[];
  children?: unknown[];
}

interface MarkdownState {
  containerFlow(node: unknown, info: unknown): string;
}

/** Evaluate the literal subset of JavaScript that docs props are written in. */
function evaluate(node: EstreeNode): unknown {
  switch (node.type) {
    case "Literal":
      return node.value;
    case "TemplateLiteral": {
      const quasis = node.quasis as { value: { cooked: string } }[];
      if (quasis.length !== 1) break;
      return quasis[0]?.value.cooked;
    }
    case "UnaryExpression": {
      const argument = evaluate(node.argument as EstreeNode);
      if (node.operator === "-" && typeof argument === "number") return -argument;
      if (node.operator === "!") return !argument;
      break;
    }
    case "ArrayExpression":
      return (node.elements as EstreeNode[]).map(evaluate);
    case "ObjectExpression": {
      const entries = (node.properties as EstreeNode[]).map((property) => {
        const key = property.key as EstreeNode;
        if (property.type !== "Property" || property.computed) {
          throw new Error("Docs component props allow only plain object properties.");
        }
        const name = key.type === "Identifier" ? key.name : key.value;
        return [name as string, evaluate(property.value as EstreeNode)] as const;
      });
      return Object.fromEntries(entries);
    }
  }
  throw new Error(`Docs component props cannot use ${node.type}.`);
}

function element(node: unknown): JsxElement {
  return node as JsxElement;
}

function attribute(node: JsxElement, name: string): unknown {
  const attr = node.attributes?.find((candidate) => candidate.name === name);
  if (!attr) return undefined;
  if (typeof attr.value === "string" || attr.value == null) return attr.value ?? true;
  const expression = attr.value.data?.estree?.body?.[0];
  if (expression?.type !== "ExpressionStatement") {
    throw new Error(`Cannot read the "${name}" prop on <${node.name}>.`);
  }
  return evaluate(expression.expression as EstreeNode);
}

function text(node: JsxElement, name: string): string {
  const value = attribute(node, name);
  return typeof value === "string" ? value : "";
}

function list<T>(node: JsxElement, name: string): T[] {
  const value = attribute(node, name);
  return Array.isArray(value) ? (value as T[]) : [];
}

function cell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ").trim();
}

function code(value: string): string {
  return value ? `\`${cell(value)}\`` : "";
}

function table(header: string[], rows: string[][]): string {
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function methodName(name: string): string {
  return name.replace(/^\./, "");
}

interface Property {
  name: string;
  type: string;
  description: string;
  isOptional?: boolean;
  isMethod?: boolean;
}

function propertiesTable(node: JsxElement): string {
  const properties = list<Property>(node, "properties");
  const rows = (items: Property[]) =>
    items.map((item) => [
      code(`${item.name}${item.isOptional ? "?" : ""}`),
      code(item.type),
      cell(item.description),
    ]);
  const header = ["Name", "Type", "Description"];
  const fields = properties.filter((item) => !item.isMethod);
  const methods = properties.filter((item) => item.isMethod);
  return [
    fields.length > 0 ? table(header, rows(fields)) : "",
    methods.length > 0 ? `**Methods**\n\n${table(header, rows(methods))}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

interface Method {
  name: string;
  params: string;
  returns?: string;
  description: string;
  terminal?: boolean;
}

function signature(method: Method): string {
  return code(`${methodName(method.name)}(${method.params})`);
}

function methodTable(node: JsxElement): string {
  const methods = list<Method>(node, "methods");
  return table(
    ["Method", "Returns", "Description"],
    methods.map((method) => [
      signature(method),
      code(method.returns ?? ""),
      cell(method.description),
    ]),
  );
}

function methodChain(node: JsxElement): string {
  const methods = list<Method>(node, "methods");
  const returns = attribute(node, "returns") as
    | { intermediate: string; terminal: string }
    | undefined;
  const rows = (items: Method[]) =>
    items.map((method) => [signature(method), cell(method.description)]);
  const header = ["Method", "Description"];
  const chainable = methods.filter((method) => !method.terminal);
  const terminal = methods.filter((method) => method.terminal);
  return [
    `Start with ${code(text(node, "starter"))}.${returns ? ` Each method returns ${code(returns.intermediate)} and can be chained.` : ""}`,
    table(header, rows(chainable)),
    terminal.length > 0
      ? `${returns ? `Terminal methods return ${code(returns.terminal)}.` : "Terminal methods end the chain."}\n\n${table(header, rows(terminal))}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

const CALLOUT_LABELS: Record<string, string> = {
  info: "Note",
  warn: "Warning",
  warning: "Warning",
  error: "Warning",
};

function callout(node: JsxElement, body: string): string {
  const label = CALLOUT_LABELS[text(node, "type")] ?? "Note";
  const [first = "", ...rest] = body.trim().split("\n");
  return [`**${label}:** ${first}`, ...rest]
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");
}

function labeled(label: string, body: string): string {
  return `**${label}**\n\n${body}`;
}

/**
 * The `filterElement` hook. Drops the tab strip, which repeats the labels each
 * tab carries, and MDX comments, which are authoring notes and not content.
 */
export function filterMdxComponent(node: {
  type: string;
  name?: string | null;
  value?: string;
}): boolean {
  if (node.type === "mdxFlowExpression" || node.type === "mdxTextExpression") {
    return !/^\s*\/\*[\s\S]*\*\/\s*$/.test(node.value ?? "");
  }
  return node.name !== "CodeBlockTabsList";
}

/**
 * The `stringify` hook for fumadocs' processed Markdown. Returns Markdown for
 * a docs component, or undefined for every other node.
 */
export function stringifyMdxComponent(
  rawNode: { type: string },
  _parent: unknown,
  state: MarkdownState,
  info: unknown,
): string | undefined {
  if (rawNode.type !== "mdxJsxFlowElement" && rawNode.type !== "mdxJsxTextElement") {
    return undefined;
  }
  const node = element(rawNode);
  const name = node.name ?? "";
  if (!name || !/^[A-Z]/.test(name)) return undefined;
  const body = () => state.containerFlow(node, info);

  switch (name) {
    case "PropertiesTable":
      return propertiesTable(node);
    case "MethodTable":
      return methodTable(node);
    case "MethodChain":
      return methodChain(node);
    case "Callout":
      return callout(node, body());
    case "Steps":
    case "Step":
    case "Tabs":
    case "CodeBlockTabs":
      return body();
    case "Tab":
    case "CodeBlockTab":
      return labeled(text(node, "value"), body());
    case "Cards":
      return (node.children ?? [])
        .map((child) => stringifyMdxComponent(child as { type: string }, node, state, info))
        .filter(Boolean)
        .join("\n");
    case "Card": {
      const title = text(node, "title");
      const href = text(node, "href");
      const heading = href ? `[${title}](${href})` : title;
      const description = body().trim().replaceAll("\n", " ");
      return `- ${heading}${description ? `: ${description}` : ""}`;
    }
    default:
      if (RUNTIME_EXPANDED_COMPONENTS.includes(name)) return undefined;
      throw new Error(
        `The docs component <${name}> has no Markdown form. Add one in src/lib/markdown-components.ts.`,
      );
  }
}
