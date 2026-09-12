import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";

/**
 * A syntax-highlighted code block for source known only at request time
 * (registry content, example source), rather than a literal fence written
 * into an MDX file. Shares the highlighter/theme fumadocs uses for every
 * other code block on the site.
 */
export function RegistryCodeBlock({
  lang,
  code,
  path,
}: {
  lang: string;
  code: string;
  /** File path caption shown above the block, e.g. "components/paradoc/field.tsx". */
  path?: string;
}) {
  return (
    <div className="not-prose my-4 overflow-x-auto">
      {path ? (
        <p className="mb-2 font-mono text-xs text-fd-muted-foreground">{path}</p>
      ) : null}
      <DynamicCodeBlock lang={lang} code={code} />
    </div>
  );
}
