import { getPropsTable, getUsageSnippet } from "@/lib/component-registry-content";
import { ComponentPropsTable } from "./component-props-table";
import { RegistryCodeBlock } from "./registry-code-block";

export interface ComponentUsageProps {
  /** Registry name of the component, e.g. "field". */
  name: string;
}

/**
 * The minimal import-and-call snippet a consumer would actually write,
 * followed by the component's props table. Usage is the call site, not the
 * installed source: a reader who wants that file has it after installing
 * (see Installation above). Both the snippet and the table are extracted or
 * derived mechanically — see `getUsageSnippet` and `getPropsTable`.
 */
export function ComponentUsage({ name }: ComponentUsageProps) {
  const code = getUsageSnippet(name);
  const props = getPropsTable(name);
  return (
    <div className="flex flex-col gap-4">
      <RegistryCodeBlock lang="tsx" code={code} />
      <ComponentPropsTable props={props} />
    </div>
  );
}
