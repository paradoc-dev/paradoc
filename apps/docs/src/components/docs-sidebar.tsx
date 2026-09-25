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
import { useTreeContext, useTreePath } from "fumadocs-ui/contexts/tree";
import type { DocsSlots } from "fumadocs-ui/layouts/notebook";
import { ScrollArea } from "@base-ui/react/scroll-area";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { DocsAreaTabs } from "@/components/docs-header";
import { SiteLinks } from "@/components/site-links";

/**
 * The sidebar slot: only the active area's tree, in compact text rows.
 *
 * Every row is 32px tall and nesting indents 8px per level. The active row is
 * foreground text at weight 500 with no fill or rail; hover only moves the
 * text color toward the foreground. Top-level folders are labeled groups that
 * always show their children; folders nested inside them collapse behind a
 * chevron and open when they hold the current page. Separators (`--- Label
 * ---` in meta.json) render as section labels. Logo, search, banner and site
 * links sit below the tree and also appear in the header on pages without a
 * sidebar.
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

// Every row shares one inline inset so a group label, a link, and the active
// pill all start on the same text edge; nesting adds to it.
const ROW_INSET_PX = 8;
const INDENT_PX = 12;

const rowBase =
  "my-0.5 flex h-[30px] items-center gap-1.5 rounded-lg pe-2 text-start text-[0.8rem] font-medium [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-fd-muted-foreground";
const linkRow = cn(
  rowBase,
  "text-fd-foreground transition-colors hover:bg-fd-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fd-ring data-[active=true]:bg-fd-foreground/5",
);
const labelRow = cn(rowBase, "w-full font-medium text-fd-foreground");
// A page's hover and active pill hug its label; a folder trigger keeps the
// full width so its chevron lines up on the right edge.
const pageRow = cn(linkRow, "w-fit max-w-full");
const folderRow = cn(linkRow, "w-full");

// A top-level folder is a group heading, not a disclosure, so its pages sit on
// the same edge as the heading. Indentation starts only inside a folder that
// collapses under a chevron: one step per collapsible level.
function indent(depth: number): CSSProperties {
  const level = Math.max(depth - 1, 0);
  return { paddingInlineStart: `${ROW_INSET_PX + INDENT_PX * level}px` };
}

// A group heading: smaller and quieter than the pages under it, with more room
// above than below so it reads as the head of the group that follows.
const groupLabel =
  "mb-1 flex h-7 items-center truncate text-xs font-medium text-fd-muted-foreground";

function DocsSidebar(props: ComponentProps<"aside">) {
  const { root } = useTreeContext();
  // One flex column, so the 1px margin on every row separates neighbours the
  // same everywhere: hover and active pills never touch.
  const tree = (
    <div className="flex flex-col">
      <TreeNodes nodes={root.children} />
    </div>
  );

  return (
    <>
      {/* The content pane: the page background behind the article and the
          table of contents, from the header row down, with a rounded corner
          where it meets the header and the sidebar. It is a grid sibling
          placed before the article, so the article and TOC paint over it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none [grid-column:3/-1] [grid-row:2/-1] rounded-tl-xl bg-fd-background max-md:hidden"
      />
      <SidebarContent>
        {({ ref }) => (
          <div
            data-sidebar-placeholder=""
            className="sticky top-(--fd-docs-row-2) z-20 flex h-[calc(var(--fd-docs-height)-var(--fd-docs-row-2))] justify-end [grid-area:sidebar] max-md:hidden md:layout:[--fd-sidebar-width:268px]"
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
              <SidebarScroll>{tree}</SidebarScroll>
              <SiteLinks className="px-4 py-3" />
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
          <DocsAreaTabs className="flex h-full min-w-0 items-center gap-1 overflow-x-auto" />
          <SidebarTrigger
            className={cn(
              buttonVariants({ size: "icon-sm", variant: "ghost" }),
              "ms-auto text-fd-muted-foreground",
            )}
            aria-label="Close sidebar"
          >
            <X />
          </SidebarTrigger>
        </div>
        <SidebarScroll>{tree}</SidebarScroll>
        <SiteLinks className="px-4 py-3" />
      </SidebarDrawerContent>
    </>
  );
}

/**
 * The sidebar's scroll area. The edges fade only while there is more to scroll
 * that way (shadcn `scroll-fade`, driven by the scroll position), so a list that
 * fits shows crisp edges and a long one hints at what is above or below.
 * No scrollbar is drawn: the fade is the only scroll affordance.
 */
function SidebarScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollArea.Root className="min-h-0 flex-1">
      <ScrollArea.Viewport className="scroll-fade-y scroll-fade-8 size-full overscroll-contain p-4">
        {children}
      </ScrollArea.Viewport>
    </ScrollArea.Root>
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
        data-sidebar-separator=""
        className={cn(groupLabel, "mt-7 first:mt-1")}
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
      className={pageRow}
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
      className={cn(depth === 0 && "mt-7 first:mt-1 [[data-sidebar-separator]+&]:mt-1")}
    >
      {node.index ? (
        <SidebarFolderLink
          href={node.index.url}
          external={node.index.external}
          active={indexActive}
          aria-current={indexActive ? "page" : undefined}
          className={pageRow}
          style={indent(depth)}
        >
          <span className="truncate">{node.name}</span>
        </SidebarFolderLink>
      ) : (
        <SidebarFolderTrigger
          className={collapsible ? folderRow : depth === 0 ? groupLabel : labelRow}
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
