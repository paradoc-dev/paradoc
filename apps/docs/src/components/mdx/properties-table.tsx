interface PropertyItem {
  name: string;
  type: string;
  description: string;
  isOptional?: boolean;
  isMethod?: boolean;
}

interface PropertiesTableProps {
  properties: PropertyItem[];
}

export const PropertiesTable = ({ properties }: PropertiesTableProps) => {
  if (!properties || properties.length === 0) return null;

  const regularProperties = properties.filter((p) => !p.isMethod);
  const methods = properties.filter((p) => p.isMethod);

  // If no methods, render with consistent container styling
  if (methods.length === 0) {
    return (
      <div className="border rounded-xl overflow-hidden divide-y divide-border/50 mb-8">
        {regularProperties.map((property) => (
          <div
            key={property.name}
            className="text-sm px-4 py-3 hover:bg-muted/50 transition-colors"
          >
            <div className="font-mono">
              <span className="font-semibold">{property.name}</span>
              {property.isOptional ? "?" : ""}
              <span className="text-muted-foreground">: {property.type}</span>
            </div>
            <div className="text-foreground/80 mt-1">
              {property.description}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // If we have both properties and methods, use container structure
  return (
    <div className="border rounded-xl overflow-hidden">
      {regularProperties.length > 0 && (
        <div className="divide-y divide-border/50">
          {regularProperties.map((property) => (
            <div
              key={property.name}
              className="text-sm px-4 py-3 hover:bg-muted/50 transition-colors"
            >
              <div className="font-mono">
                <span className="font-semibold">{property.name}</span>
                {property.isOptional ? "?" : ""}
                <span className="text-muted-foreground">: {property.type}</span>
              </div>
              <div className="text-foreground/80 mt-1">
                {property.description}
              </div>
            </div>
          ))}
        </div>
      )}
      {methods.length > 0 && (
        <>
          <div className="relative">
            <div className="border-t-2 border-dashed" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 bg-orange-100 dark:bg-orange-800 border border-orange-500 dark:border-orange-300 rounded-md px-2 py-0.5 text-xs text-orange-700 dark:text-orange-100">
              Methods
            </span>
          </div>
          <div className="divide-y divide-border/50">
            {methods.map((property) => (
              <div
                key={property.name}
                className="text-sm px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="font-mono">
                  <span className="font-semibold">{property.name}</span>
                  <span className="text-muted-foreground">
                    : {property.type}
                  </span>
                </div>
                <div className="text-foreground/80 mt-1">
                  {property.description}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
