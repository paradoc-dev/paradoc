interface MethodItem {
  name: string;
  params: string;
  returns: string;
  description: string;
}

interface MethodTableProps {
  methods: MethodItem[];
}

export const MethodTable = ({ methods }: MethodTableProps) => {
  if (!methods || methods.length === 0) return null;

  // Strip leading dot from method name if present
  const formatName = (name: string) => name.replace(/^\./, '');

  return (
    <div className="-space-y-[1px]">
      {methods.map((method) => (
        <div
          key={method.name}
          className="text-sm border px-4 py-3 first:rounded-t-xl last:rounded-b-xl hover:bg-muted/50 transition-colors"
        >
          {/* Method signature */}
          <div className="flex flex-wrap items-center gap-y-0.5 font-mono">
            <span className="font-semibold">{formatName(method.name)}</span>
            <span className="text-muted-foreground">: ({method.params}) {'=>'} {method.returns}</span>
          </div>

          {/* Description */}
          <div className="text-foreground/80 mt-1">{method.description}</div>
        </div>
      ))}
    </div>
  );
};
