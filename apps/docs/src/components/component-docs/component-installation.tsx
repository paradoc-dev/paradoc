import { getRegistryItem } from "@/lib/component-registry-content";
import { RegistryCodeBlock } from "./registry-code-block";

export interface ComponentInstallationProps {
  /** Registry name of the component, e.g. "field". */
  name: string;
}

/**
 * The install command and the file(s) it places, per the spec's Installation
 * anatomy section. The command is templated from the registry item's own
 * name — never a hand-typed literal per page — and the target path and any
 * brought-along dependencies come straight from the registry item.
 */
export function ComponentInstallation({ name }: ComponentInstallationProps) {
  const item = getRegistryItem(name);
  const file = item.files[0];
  const registryDeps = (item.registryDependencies ?? []).map((dep) =>
    dep.replace(/^@paradoc\//, ""),
  );

  return (
    <div className="flex flex-col gap-4">
      <RegistryCodeBlock lang="bash" code={`npx shadcn@4 add @paradoc/${name}`} />
      <p className="text-sm text-fd-muted-foreground">
        Or, with the Paradoc CLI, which writes the namespace into{" "}
        <code>components.json</code> for you:
      </p>
      <RegistryCodeBlock lang="bash" code={`paradoc add ${name}`} />
      {file?.target ? (
        <p className="text-sm text-fd-muted-foreground">
          Installs to <code>{file.target}</code>
          {registryDeps.length > 0 ? (
            <>
              {" "}
              and brings along{" "}
              {registryDeps.map((dep, index) => (
                <span key={dep}>
                  {index > 0 ? ", " : null}
                  <code>{dep}</code>
                </span>
              ))}
            </>
          ) : null}
          .
        </p>
      ) : null}
    </div>
  );
}
