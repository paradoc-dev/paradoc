import type { InferPageType } from "fumadocs-core/source";

import {
  getBlockUsageFiles,
  getPreviewSource,
  getPropsTable,
  getRegistryItem,
  getUsageSnippet,
  getVariantSource,
} from "@/lib/component-registry-content";
import type { source } from "@/lib/source";

function fence(language: string, code: string): string {
  return `\n\`\`\`${language}\n${code.trim()}\n\`\`\`\n`;
}

function installation(name: string): string {
  const item = getRegistryItem(name);
  const targets = item.files.map((file) => file.target).filter(Boolean).join(", ");
  return [
    fence("bash", `npx shadcn@4 add @paradoc/${name}`),
    fence("bash", `paradoc add ${name}`),
    targets ? `\nInstalls to ${targets}.\n` : "",
  ].join("\n");
}

function usage(name: string): string {
  const rows = getPropsTable(name).map(
    (prop) =>
      `| \`${prop.name}\` | \`${prop.type.replaceAll("|", "\\|")}\` | ${prop.optional ? "Yes" : "No"} | ${prop.defaultValue ?? ""} | ${prop.description.replaceAll("|", "\\|")} |`,
  );
  return `${fence("tsx", getUsageSnippet(name))}\n| Prop | Type | Optional | Default | Description |\n| --- | --- | --- | --- | --- |\n${rows.join("\n")}\n`;
}

function blockUsage(name: string): string {
  const { composition, data } = getBlockUsageFiles(name);
  return `\n**Composition**\n${fence("tsx", composition.content ?? "")}\n**Sample data**\n${fence("ts", data.content ?? "")}`;
}

/** Replace component-doc placeholders with the built registry and example content. */
export function expandComponentMarkdown(markdown: string): string {
  return markdown.replace(
    /<(ComponentInstallation|ComponentPreview|ComponentUsage|ComponentVariant|BlockUsage)\s+name="([^"]+)"(?:\s+variant="([^"]+)")?\s*\/>/g,
    (_tag, component: string, name: string, variant?: string) => {
      switch (component) {
        case "ComponentInstallation":
          return installation(name);
        case "ComponentPreview":
          return fence("tsx", getPreviewSource(name));
        case "ComponentUsage":
          return usage(name);
        case "ComponentVariant":
          return fence("tsx", getVariantSource(name, variant ?? ""));
        case "BlockUsage":
          return blockUsage(name);
        default:
          return _tag;
      }
    },
  );
}

export async function getPageMarkdown(
  page: InferPageType<typeof source>,
): Promise<string> {
  return expandComponentMarkdown(await page.data.getText("processed"));
}
