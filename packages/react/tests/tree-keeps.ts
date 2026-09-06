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

/**
 * The digits a piece of text carries, as tokens, in the order they appear.
 *
 * A second way to say which keep a page opened on, for a document whose words a
 * PDF's text layer cannot give back. Shaped Arabic reaches the file as
 * contextual presentation forms with no map to the characters it was written
 * in, but a run of Western digits is a run of Western digits on both sides:
 * `1,850.00` comes back as `1,850.00`. So a keep that carries figures — a table
 * row, a total, a reference number — is still identifiable from the PDF's own
 * text, which is the property the criterion needs.
 *
 * Digits only, with the separators inside a number kept so `1,850.00` is one
 * token rather than three. Anything else is dropped, because everything else is
 * exactly what does not survive.
 */
export function digitTokens(text: string): string[] {
  return (text.match(/\d[\d.,]*\d|\d/gu) ?? []).filter((token) => token.length > 0);
}

/**
 * True when the first `tokens.length` of `page` are the same tokens as `tokens`,
 * regardless of their order.
 *
 * A prefix comparison, because "the page opens on this keep" is a statement
 * about the start of the page. A *multiset* comparison, because a right-to-left
 * row is emitted column by column and the bidirectional algorithm may report a
 * row's own figures in a different order from the one the tree wrote them in.
 * The row is still the unit, so the tokens are the same tokens either way, and
 * a page that opened on a different row would carry different figures rather
 * than the same ones rearranged.
 */
export function opensWithTokens(page: readonly string[], tokens: readonly string[]): boolean {
  if (tokens.length === 0 || tokens.length > page.length) return false;
  const head = [...page.slice(0, tokens.length)].sort();
  const wanted = [...tokens].sort();
  return head.every((token, index) => token === wanted[index]);
}
