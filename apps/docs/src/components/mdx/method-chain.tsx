import { CornerDownRightIcon } from "lucide-react";

interface MethodItem {
  name: string;
  params: string;
  description: string;
  terminal?: boolean;
}

interface MethodChainProps {
  starter: string;
  methods: MethodItem[];
  returns: {
    intermediate: string;
    terminal: string;
  };
}

export const MethodChain = ({ starter, methods, returns }: MethodChainProps) => {
  const chainableMethods = methods.filter((m) => !m.terminal);
  const terminalMethods = methods.filter((m) => m.terminal);

  return (
    <div className="text-sm">
      {/* Chainable info - outside the table */}
      <p className="mb-3 text-base">
        All methods return <code>{returns.intermediate}</code> and are chainable.
      </p>

      <div className="border rounded-xl overflow-hidden">
        {/* Header - starter */}
        <div className="bg-muted/50 px-4 py-2 border-b">
          <span className="font-mono font-semibold">{starter}</span>
        </div>

        {/* Chainable methods */}
        <div className="divide-y divide-border/50">
          {chainableMethods.map((method) => (
            <div
              key={method.name}
              className="px-4 py-2 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-start gap-2">
                <CornerDownRightIcon className="text-muted-foreground/50 shrink-0 size-4 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="font-mono">
                    <span className="font-semibold">{method.name.replace(/^\./, "")}</span>
                    <span className="text-muted-foreground">: ({method.params}) {'=>'} {returns.intermediate}</span>
                  </span>
                  <div className="text-muted-foreground mt-0.5">
                    {method.description}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Terminal methods */}
        {terminalMethods.length > 0 && (
          <div className="border-t-2 border-dashed divide-y divide-border/50">
            {terminalMethods.map((method) => (
              <div
                key={method.name}
                className="px-4 py-2 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <CornerDownRightIcon className="text-muted-foreground/50 shrink-0 size-4 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="font-mono">
                      <span className="font-semibold">{method.name.replace(/^\./, "")}</span>
                      <span className="text-muted-foreground">: ({method.params}) {'=>'} {returns.terminal}</span>
                    </span>
                    <div className="text-muted-foreground mt-0.5">
                      {method.description}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
