/**
 * The document's keeps as the PDF engine resolves them, with the text each one
 * carries.
 *
 * A test that asks what a PDF page starts with has only two things to work
 * with: the page's text, and a way to say which keep that text belongs to.
 * This is the second. It walks the node tree `@takumi-rs/helpers` produces —
 * after the components have run, before the classes have become styles — so the
 * ids, the table membership and the document order are the ones the render
 * itself sees rather than a second description of them.
 */

import type { Node } from "@takumi-rs/helpers";

/** One pagination unit in the resolved tree. */
export interface TreeKeep {
  /** The keep's `data-keep-id`. */
  id: string;
  /** Every text run under the keep, joined. */
  text: string;
  /** The table this keep belongs to, when it is a header or a row. */
  table?: string;
  /** True when the keep is its table's repeatable header. */
  tableHeader: boolean;
}

/** Every text run under `node`, joined. */
export function textOf(node: Node): string {
  if (node.type === "text") return node.text;
  if (node.type === "container" && node.children) return node.children.map(textOf).join("");
  return "";
}

/** Every keep under `node`, in document order. */
export function treeKeeps(node: Node, into: TreeKeep[] = []): TreeKeep[] {
  const attributes = node.attributes ?? {};
  const id = attributes["data-keep-id"];
  if (id !== undefined) {
    const header = attributes["data-table-header"];
    const row = attributes["data-table-row"];
    into.push({ id, text: textOf(node), table: header ?? row, tableHeader: header !== undefined });
  }
  if (node.type === "container" && node.children) {
    for (const child of node.children) treeKeeps(child, into);
  }
  return into;
}

/**
 * Text reduced to what a comparison can rely on.
 *
 * The engine writes a space between runs the DOM has none between, and a
 * heading styled `uppercase` reaches the PDF uppercased while the DOM keeps the
 * label the artifact declares. Neither difference is about pagination.
 */
export function normalizeText(text: string): string {
  return text.replaceAll(/\s+/gu, "").toUpperCase();
}
