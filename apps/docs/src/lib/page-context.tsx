import { createContext, useContext, type ReactNode } from 'react';

interface PageContextValue {
  url: string;
  filePath: string;
}

const PageContext = createContext<PageContextValue | null>(null);

export function PageProvider({
  children,
  url,
  filePath,
}: PageContextValue & { children: ReactNode }) {
  return (
    <PageContext.Provider value={{ url, filePath }}>
      {children}
    </PageContext.Provider>
  );
}

export function usePageContext() {
  const context = useContext(PageContext);
  if (!context) {
    throw new Error('usePageContext must be used within a PageProvider');
  }
  return context;
}
