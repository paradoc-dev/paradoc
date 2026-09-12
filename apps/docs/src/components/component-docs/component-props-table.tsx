import type React from "react";
import type { PropRow } from "@/lib/registry-types";

/**
 * Prop, type, default, and one-line description — mechanically derived from
 * the component's own exported props interface (see `getPropsTable`), never
 * hand-typed. The first three columns never wrap and the wrapper scrolls
 * horizontally on a narrow viewport; the description wraps, and a
 * backtick-quoted span in it renders as inline code.
 */
function describe(text: string) {
  const nodes: React.ReactNode[] = [];
  let offset = 0;
  for (const part of text.split(/(`[^`]+`)/)) {
    if (part.startsWith("`") && part.endsWith("`")) {
      nodes.push(
        <code key={offset} className="font-mono text-xs">
          {part.slice(1, -1)}
        </code>,
      );
    } else if (part) {
      nodes.push(part);
    }
    offset += part.length;
  }
  return nodes;
}

export function ComponentPropsTable({ props }: { props: PropRow[] }) {
  if (props.length === 0) return null;

  return (
    <div className="not-prose my-4 overflow-x-auto rounded-lg border border-fd-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-fd-border bg-fd-muted/50 text-left">
            <th className="px-4 py-2 font-medium text-fd-muted-foreground">Prop</th>
            <th className="px-4 py-2 font-medium text-fd-muted-foreground">Type</th>
            <th className="px-4 py-2 font-medium text-fd-muted-foreground">Default</th>
            <th className="px-4 py-2 font-medium text-fd-muted-foreground">Description</th>
          </tr>
        </thead>
        <tbody>
          {props.map((prop) => (
            <tr key={prop.name} className="border-b border-fd-border last:border-0">
              <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">
                {prop.name}
                {prop.optional ? "?" : ""}
              </td>
              <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-fd-muted-foreground">
                {prop.type}
              </td>
              <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-fd-muted-foreground">
                {prop.defaultValue ?? "—"}
              </td>
              <td className="min-w-64 px-4 py-2 text-fd-muted-foreground">{prop.description ? describe(prop.description) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
