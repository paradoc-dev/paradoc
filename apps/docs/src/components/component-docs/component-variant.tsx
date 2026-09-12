import { Tab, Tabs } from "fumadocs-ui/components/tabs";

import { getVariantSource } from "@/lib/component-registry-content";
import { LiveFrame } from "./live-frame";
import { COMPONENT_VARIANTS } from "./preview-registry";
import { RegistryCodeBlock } from "./registry-code-block";

export interface ComponentVariantProps {
  /** Registry name of the component, e.g. "field". */
  name: string;
  /** Variant key within that component, e.g. "no-label". */
  variant: string;
}

/**
 * Live-renders one alternate configuration of `name`'s own component, on a
 * **Preview** tab, next to a **Code** tab showing that variant's own
 * rewritten source. One instance per Variant subheading, so multiple
 * variants are never stacked without a way to tell which is which. See
 * `preview-registry.tsx` for the name/variant → component map.
 */
export function ComponentVariant({ name, variant }: ComponentVariantProps) {
  const Variant = COMPONENT_VARIANTS[name]?.[variant];
  if (!Variant) {
    throw new Error(
      `No variant "${variant}" registered for component "${name}". Add it to COMPONENT_VARIANTS in src/components/component-docs/preview-registry.tsx.`,
    );
  }
  const code = getVariantSource(name, variant);

  return (
    <Tabs items={["Preview", "Code"]}>
      <Tab value="Preview">
        <LiveFrame>
          <Variant />
        </LiveFrame>
      </Tab>
      <Tab value="Code">
        <RegistryCodeBlock lang="tsx" code={code} />
      </Tab>
    </Tabs>
  );
}
