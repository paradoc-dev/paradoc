import type { PropRow } from "@/lib/registry-types";

/**
 * Prop, type, default, and one-line description — mechanically derived from
 * the component's own exported props interface (see `getPropsTable`), never
 * hand-typed. Wrapped for horizontal scroll, since a union type or a long
 * description should scroll rather than clip on a narrow viewport.
 */
export function ComponentPropsTable({ props }: { props: PropRow[] }) {
  if (props.length === 0) return null;

  return (
    <div className="not-prose my-4 overflow-x-auto rounded-lg border border-fd-border">
      <table className="w-full min-w-max border-collapse text-sm">
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
              <td className="px-4 py-2 text-fd-muted-foreground">{prop.description || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
