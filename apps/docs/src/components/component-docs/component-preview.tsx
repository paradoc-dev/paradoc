import { Tab, Tabs } from "fumadocs-ui/components/tabs";

import { getPreviewSource } from "@/lib/component-registry-content";
import { LiveFrame } from "./live-frame";
import { COMPONENT_DEMOS } from "./preview-registry";
import { RegistryCodeBlock } from "./registry-code-block";

export interface ComponentPreviewProps {
  /** Registry name of the component, e.g. "field". */
  name: string;
}

/**
 * Live-renders the real component tree for `name` on a **Preview** tab,
 * client-side only, next to a **Code** tab showing the same demo composition
 * rewritten to the form a consumer would actually write (see
 * `getPreviewSource`). See `preview-registry.tsx` for the name → demo
 * composition map.
 */
export function ComponentPreview({ name }: ComponentPreviewProps) {
  const Demo = COMPONENT_DEMOS[name];
  if (!Demo) {
    throw new Error(
      `No live preview registered for component "${name}". Add it to COMPONENT_DEMOS in src/components/component-docs/preview-registry.tsx.`,
    );
  }
  const code = getPreviewSource(name);

  return (
    <Tabs items={["Preview", "Code"]}>
      <Tab value="Preview">
        <LiveFrame>
          <Demo />
        </LiveFrame>
      </Tab>
      <Tab value="Code">
        <RegistryCodeBlock lang="tsx" code={code} />
      </Tab>
    </Tabs>
  );
}
