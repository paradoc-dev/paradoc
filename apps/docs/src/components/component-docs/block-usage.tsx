import { getBlockUsageFiles } from "@/lib/component-registry-content";
import { RegistryCodeBlock } from "./registry-code-block";

export interface BlockUsageProps {
  /** Registry name of the block, e.g. "invoice". */
  name: string;
}

/**
 * A block's Usage section.
 *
 * A base component's Usage is a minimal, extracted call-site snippet plus a
 * props table (see `ComponentUsage`), because it has exactly one natural way
 * to call it. A block has no single call site — it is a whole document — so
 * this shows its real, currently-shipping composition file and sample-data
 * file in full instead, both read straight from the same generated registry
 * content Installation reads (see `getBlockUsageFiles`). Neither is
 * extracted, rewritten, or hand-typed: this is exactly what installing the
 * block gives a consumer.
 */
export function BlockUsage({ name }: BlockUsageProps) {
  const { composition, data } = getBlockUsageFiles(name);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-fd-foreground">Composition</p>
        <RegistryCodeBlock lang="tsx" code={composition.content ?? ""} path={composition.target} />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-fd-foreground">Sample data</p>
        <RegistryCodeBlock lang="ts" code={data.content ?? ""} path={data.target} />
      </div>
    </div>
  );
}
