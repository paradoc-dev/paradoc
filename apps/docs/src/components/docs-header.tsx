import { createContext, use, type ComponentProps, type ReactNode } from "react";
import Link from "fumadocs-core/link";
import { useNotebookLayout } from "fumadocs-ui/layouts/notebook";
import { LinkItem } from "fumadocs-ui/layouts/shared";
import { SidebarIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/components/ui/button";

export interface DocsTab {
  title: string;
  url: string;
}

interface DocsShell {
  tabs: DocsTab[];
  /** Index into `tabs` of the area holding the current page. */
  activeTab: number;
}

const DocsShellContext = createContext<DocsShell | null>(null);

export function DocsShellProvider({
  tabs,
  activeTab,
  children,
}: DocsShell & { children: ReactNode }) {
  return (
    <DocsShellContext value={{ tabs, activeTab }}>{children}</DocsShellContext>
  );
}

function useDocsShell(): DocsShell {
  const shell = use(DocsShellContext);
  if (!shell) throw new Error("<DocsHeader /> and <DocsAreaTabs /> must render under <DocsShellProvider />");
  return shell;
}

/**
 * The site header, rendered on every page: logo, area tabs, search, site
 * links and the theme toggle. On phones the tabs move to a second row so the
 * areas stay reachable from every page, including the ones without a sidebar.
 */
export function DocsHeader(props: ComponentProps<"header">) {
  const { slots, navItems } = useNotebookLayout();
  const iconLinks = navItems.filter((item) => item.type === "icon");
  // Only icon links have a home in this header, and `on: "nav"` keeps every
  // link out of the sidebar menu, so any other kind would vanish silently.
  const unsupported = navItems.find((item) => item.type !== "icon");
  if (unsupported) {
    throw new Error(`DocsHeader renders icon links only; got a "${unsupported.type}" link`);
  }

  // --fd-header-height drives the sticky offsets of the sidebar and TOC. It is
  // the 14 row on md+, and on phones the 14 row plus the 10 tabs row: 24.
  return (
    <header
      id="nd-subnav"
      {...props}
      className={cn(
        "sticky [grid-area:header] top-(--fd-docs-row-1) z-10 flex flex-col bg-fd-background/80 backdrop-blur-sm",
        "layout:[--fd-header-height:--spacing(24)] md:layout:[--fd-header-height:--spacing(14)]",
        props.className,
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b px-4 md:px-6">
        {slots.navTitle && (
          <slots.navTitle className="inline-flex items-center" />
        )}
        <DocsAreaTabs className="ms-6 hidden h-full items-center gap-5 md:flex" />
        <div className="flex flex-1 items-center justify-end gap-1 md:gap-2">
          {slots.searchTrigger && (
            <>
              <slots.searchTrigger.full
                hideIfDisabled
                className="w-full max-w-[240px] max-md:hidden"
              />
              <slots.searchTrigger.sm hideIfDisabled className="p-2 md:hidden" />
            </>
          )}
          {iconLinks.map((item) => (
            <LinkItem
              key={item.url}
              item={item}
              aria-label={item.label}
              className={cn(
                buttonVariants({ size: "icon-sm", color: "ghost" }),
                "text-fd-muted-foreground",
              )}
            >
              {item.icon}
            </LinkItem>
          ))}
          {slots.themeSwitch && <slots.themeSwitch />}
          {slots.sidebar && (
            <slots.sidebar.trigger
              className={cn(
                buttonVariants({ size: "icon-sm", color: "ghost" }),
                "-me-1.5 md:hidden",
              )}
            >
              <SidebarIcon />
            </slots.sidebar.trigger>
          )}
        </div>
      </div>
      <DocsAreaTabs className="flex h-10 items-center gap-5 overflow-x-auto border-b px-4 md:hidden" />
    </header>
  );
}

/** The three area tabs; the header on every width, and the phone drawer. */
export function DocsAreaTabs(props: ComponentProps<"nav">) {
  const { tabs, activeTab } = useDocsShell();

  return (
    <nav aria-label="Documentation areas" {...props}>
      {tabs.map((tab, i) => {
        const active = i === activeTab;
        return (
          <Link
            key={tab.url}
            href={tab.url}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-full items-center border-b-2 border-transparent text-sm font-medium text-nowrap text-fd-muted-foreground transition-colors hover:text-fd-accent-foreground",
              active && "border-fd-primary text-fd-primary",
            )}
          >
            {tab.title}
          </Link>
        );
      })}
    </nav>
  );
}
