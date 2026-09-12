import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { usePathname } from "fumadocs-core/framework";
import type * as PageTree from "fumadocs-core/page-tree";
import {
  SidebarCollapseTrigger,
  SidebarContent,
  SidebarDrawerContent,
  SidebarDrawerOverlay,
  SidebarFolder,
  SidebarFolderContent,
  SidebarFolderLink,
  SidebarFolderTrigger,
  SidebarItem,
  SidebarProvider,
  SidebarTrigger,
  useFolderDepth,
  useSidebar,
} from "fumadocs-ui/components/sidebar/base";
import {
  ScrollArea,
  ScrollViewport,
} from "fumadocs-ui/components/ui/scroll-area";
import { useTreeContext, useTreePath } from "fumadocs-ui/contexts/tree";
import type { DocsSlots } from "fumadocs-ui/layouts/notebook";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/components/ui/button";
import { DocsAreaTabs } from "@/components/docs-header";

/**
 * The sidebar slot: only the active area's tree, in compact text rows.
 *
 * Every row is 32px tall and nesting indents 8px per level. The active row is
 * foreground text at weight 500 with no fill or rail; hover only moves the
 * text color toward the foreground. Top-level folders are labeled groups that
 * always show their children; folders nested inside them collapse behind a
 * chevron and open when they hold the current page. Separators (`--- Label
 * ---` in meta.json) render as section labels. Logo, search, banner and site
 * links live in the header, so none of them appear here.
 *
 * The provider, drawer and collapsible mechanics are the stock Fumadocs
 * primitives; only the composition and the rows are owned here.
 */
export const docsSidebar: DocsSlots["sidebar"] = {
  provider: SidebarProvider,
  root: DocsSidebar,
  trigger: SidebarTrigger,
  collapseTrigger: SidebarCollapseTrigger,
  useSidebar,
};

/** An area of one page (the changelog) has nothing to list: no sidebar, full width. */
export const noSidebar: DocsSlots["sidebar"] = {
  provider: SidebarProvider,
  root: () => null,
  trigger: () => null,
  collapseTrigger: () => null,
  useSidebar,
};

const INDENT_PX = 8;

const rowBase =
  "flex h-8 w-full items-center gap-1.5 text-start text-sm [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-fd-muted-foreground";
const linkRow = cn(
  rowBase,
  "text-fd-muted-foreground transition-colors hover:text-fd-foreground data-[active=true]:font-medium data-[active=true]:text-fd-foreground",
);
const labelRow = cn(rowBase, "font-medium text-fd-foreground");

function indent(depth: number): CSSProperties {
  return { paddingInlineStart: `${INDENT_PX * depth}px` };
}

function DocsSidebar(props: ComponentProps<"aside">) {
  const { root } = useTreeContext();
  const tree = <TreeNodes nodes={root.children} />;

  return (
    <>
      <SidebarContent>
        {({ ref }) => (
          <div
            data-sidebar-placeholder=""
            className="sticky top-(--fd-docs-row-2) z-20 h-[calc(var(--fd-docs-height)-var(--fd-docs-row-2))] [grid-area:sidebar] max-md:hidden md:layout:[--fd-sidebar-width:268px]"
          >
            <aside
              id="nd-sidebar"
              ref={ref}
              {...props}
              className={cn(
                "flex h-full w-(--fd-sidebar-width) flex-col",
                props.className,
              )}
            >
              <Viewport>{tree}</Viewport>
            </aside>
          </div>
        )}
      </SidebarContent>
      <SidebarDrawerOverlay className="fixed inset-0 z-40 backdrop-blur-xs data-[state=open]:animate-fd-fade-in data-[state=closed]:animate-fd-fade-out" />
      <SidebarDrawerContent
        {...props}
        className={cn(
          "fixed inset-y-0 inset-e-0 z-40 flex w-[85%] max-w-[380px] flex-col border-s bg-fd-background shadow-lg data-[state=open]:animate-fd-sidebar-in data-[state=closed]:animate-fd-sidebar-out",
          props.className,
        )}
      >
        <div className="flex h-14 shrink-0 items-center border-b px-4">
          <DocsAreaTabs className="flex h-full items-center gap-5" />
          <SidebarTrigger
            className={cn(
              buttonVariants({ size: "icon-sm", color: "ghost" }),
              "ms-auto text-fd-muted-foreground",
            )}
            aria-label="Close sidebar"
          >
            <X />
          </SidebarTrigger>
        </div>
        <Viewport>{tree}</Viewport>
      </SidebarDrawerContent>
    </>
  );
}

function Viewport({ children }: { children: ReactNode }) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <ScrollViewport className="p-4 overscroll-contain mask-[linear-gradient(to_bottom,transparent,white_12px,white_calc(100%-12px),transparent)] *:flex! *:flex-col!">
        {children}
      </ScrollViewport>
    </ScrollArea>
  );
}

function TreeNodes({ nodes }: { nodes: PageTree.Node[] }) {
  return nodes.map((node, index) => (
    <TreeNode key={keyOf(node, index)} node={node} />
  ));
}

// The loader stamps every node with a stable `$id`; the index only covers a
// hand-built tree without one.
function keyOf(node: PageTree.Node, index: number): string {
  return node.$id ?? `${node.type}:${index}`;
}

function TreeNode({ node }: { node: PageTree.Node }) {
  const depth = useFolderDepth();
  const pathname = usePathname();

  if (node.type === "separator") {
    return (
      <p
        className="mt-4 flex h-8 items-center truncate text-xs font-medium uppercase tracking-wider text-fd-muted-foreground first:mt-0"
        style={indent(depth)}
      >
        {node.name}
      </p>
    );
  }

  if (node.type === "folder") {
    return <TreeFolder node={node} depth={depth} pathname={pathname} />;
  }

  const active = isActive(node.url, pathname);
  return (
    <SidebarItem
      href={node.url}
      external={node.external}
      active={active}
      aria-current={active ? "page" : undefined}
      className={linkRow}
      style={indent(depth)}
    >
      <span className="truncate">{node.name}</span>
    </SidebarItem>
  );
}

function TreeFolder({
  node,
  depth,
  pathname,
}: {
  node: PageTree.Folder;
  /** Nesting level of the folder's own row; its children sit one deeper. */
  depth: number;
  pathname: string;
}) {
  // A top-level folder is a group: its children are always listed. Deeper
  // folders collapse, and open when they hold the current page.
  const collapsible = depth > 0 && node.collapsible !== false;
  // The tree context resolves the folders on the way to the current page.
  const path = useTreePath();
  const indexActive = node.index ? isActive(node.index.url, pathname) : false;

  return (
    <SidebarFolder
      collapsible={collapsible}
      active={path.includes(node)}
      defaultOpen={node.defaultOpen}
      className={cn(depth === 0 && "mt-2")}
    >
      {node.index ? (
        <SidebarFolderLink
          href={node.index.url}
          external={node.index.external}
          active={indexActive}
          aria-current={indexActive ? "page" : undefined}
          className={linkRow}
          style={indent(depth)}
        >
          <span className="truncate">{node.name}</span>
        </SidebarFolderLink>
      ) : (
        <SidebarFolderTrigger
          className={collapsible ? linkRow : labelRow}
          style={indent(depth)}
        >
          <span className="truncate">{node.name}</span>
        </SidebarFolderTrigger>
      )}
      <SidebarFolderContent>
        <div className="flex flex-col">
          <TreeNodes nodes={node.children} />
        </div>
      </SidebarFolderContent>
    </SidebarFolder>
  );
}

function isActive(href: string, pathname: string): boolean {
  return trimSlash(href) === trimSlash(pathname);
}

function trimSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}
