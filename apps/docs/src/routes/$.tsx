import type { ComponentType } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { DocsLayout, type DocsSlots } from "fumadocs-ui/layouts/notebook";
import {
  SidebarProvider,
  useSidebar,
} from "fumadocs-ui/layouts/notebook/slots/sidebar";
import { createServerFn } from "@tanstack/react-start";
import { source, docsAreas, getPageImage } from "@/lib/source";
import { findDocsArea } from "@/lib/docs-areas";
import browserCollections from "fumadocs-mdx:collections/browser";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/notebook/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { baseOptions } from "@/lib/layout.shared";
import { DocsHeader, DocsShellProvider } from "@/components/docs-header";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { Link } from "@tanstack/react-router";
export const Route = createFileRoute("/$")({
  component: Page,
  loader: async ({ params }) => {
    const slugs = params._splat?.split("/") ?? [];
    const data = await serverLoader({ data: slugs });
    await clientLoader.preload(data.path);
    return data;
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.title
          ? `${loaderData.title} | Paradoc Docs`
          : "Paradoc Docs",
      },
      {
        name: "description",
        content: loaderData?.description ?? "Documents as code for developers and AI agents",
      },
      {
        property: "og:title",
        content: loaderData?.ogTitle ?? loaderData?.title ?? "Paradoc Documentation",
      },
      {
        property: "og:description",
        content: loaderData?.ogDescription ?? loaderData?.description ?? "Documents as code for developers and AI agents",
      },
      {
        property: "og:image",
        content: loaderData?.ogImageUrl
          ? `https://docs.paradoc.dev${loaderData.ogImageUrl}`
          : "https://assets.paradoc.dev/paradoc-og-docs.png",
      },
      {
        property: "og:url",
        content: loaderData?.url
          ? `https://docs.paradoc.dev${loaderData.url}`
          : "https://docs.paradoc.dev",
      },
      {
        name: "twitter:title",
        content: loaderData?.ogTitle ?? loaderData?.title ?? "Paradoc Documentation",
      },
      {
        name: "twitter:description",
        content: loaderData?.ogDescription ?? loaderData?.description ?? "Documents as code for developers and AI agents",
      },
      {
        name: "twitter:image",
        content: loaderData?.ogImageUrl
          ? `https://docs.paradoc.dev${loaderData.ogImageUrl}`
          : "https://assets.paradoc.dev/paradoc-og-docs.png",
      },
    ],
  }),
  notFoundComponent: () => {
    return (
      <main className="flex flex-col items-center justify-center h-screen">
        <div className="flex flex-col items-center justify-center gap-4">
          <h1>Not Found</h1>
          <p>This page doesn't exist...</p>
          <Link to="/$" className="bg-secondary px-4 py-2 rounded-md">
            Go back to the home page
          </Link>
        </div>
      </main>
    );
  },
});

const serverLoader = createServerFn({
  method: "GET",
})
  .inputValidator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => {
    const page = source.getPage(slugs);
    if (!page) throw notFound();

    const ogImage = getPageImage(page);
    const area = findDocsArea(docsAreas, page.url);

    return {
      path: page.path,
      url: page.url,
      // Only the active area's tree: the sidebar lists nothing else.
      pageTree: await source.serializePageTree(area.tree),
      tabs: docsAreas.map(({ title, url }) => ({ title, url })),
      activeTab: docsAreas.indexOf(area),
      sidebar: area.sidebar,
      title: page.data.title,
      description: page.data.description,
      ogTitle: page.data.ogTitle ?? page.data.title,
      ogDescription: page.data.ogDescription ?? page.data.description,
      ogImageUrl: ogImage.url,
    };
  });

import { PageLastUpdate } from "fumadocs-ui/layouts/notebook/page";

import {
  PropertiesTable,
  DesignTimeBadge,
  RunTimeBadge,
  MethodChain,
  MethodTable,
  BlockUsage,
  ComponentPreview,
  ComponentVariant,
  ComponentInstallation,
  ComponentUsage,
} from "@/components/mdx";

const clientLoader = browserCollections.docs.createClientLoader({
  component({ toc, frontmatter, default: MDX, lastModified }) {
    return (
      <DocsPage toc={toc}>
        <DocsTitle>
          <div className="flex justify-between gap-4">
            <span className="tracking-tight">{frontmatter.title}</span>
            {lastModified && (
              <PageLastUpdate
                date={lastModified}
                className="text-xs text-muted-foreground font-normal"
              />
            )}
          </div>
        </DocsTitle>
        <DocsDescription className="p-0!">
          {frontmatter.description}
        </DocsDescription>

        <PageActions />

        <DocsBody>
          <MDX
            components={{
              ...defaultMdxComponents,
              h1: (props) => (
                <h1
                  {...props}
                  className="tracking-tight text-[1.35rem] font-semibold text-foreground/90 dark:text-foreground/100"
                />
              ),
              h2: (props) => (
                <h2
                  {...props}
                  className="tracking-tight text-lg font-semibold text-foreground/90"
                />
              ),
              h3: (props) => (
                <h3
                  {...props}
                  className="font-semibold text-base text-foreground/90"
                />
              ),
              h4: (props) => (
                <h4
                  {...props}
                  className="font-semibold text-base text-foreground/90"
                />
              ),
              h5: (props) => (
                <h5
                  {...props}
                  className="font-semibold text-base text-muted-foreground uppercase"
                />
              ),
              strong: (props) => (
                <strong {...props} className="font-semibold" />
              ),
              code: (props) => (
                <code {...props} className="line-[1rem] py-0.25 font-medium" />
              ),
              li: (props) => <li {...props} className="leading-normal ml-4" />,
              a: (props) => (
                <a
                  {...props}
                  className="text-primary no-underline font-medium"
                />
              ),
              PropertiesTable,
              DesignTimeBadge,
              RunTimeBadge,
              MethodChain,
              MethodTable,
              BlockUsage,
              ComponentPreview,
              ComponentVariant,
              ComponentInstallation,
              ComponentUsage,
              Tab,
              Tabs,
            }}
          />
        </DocsBody>
      </DocsPage>
    );
  },
});

/** An area of one page (the changelog) has nothing to list: no sidebar, full width. */
const noSidebar: DocsSlots["sidebar"] = {
  provider: SidebarProvider,
  root: () => null,
  trigger: () => null,
  collapseTrigger: () => null,
  useSidebar,
};

// A function footer replaces the stock sidebar footer outright. The drawer on
// phones would otherwise render the theme toggle there; the header is the only
// place it appears.
const noFooter = () => null;

function Page() {
  const data = Route.useLoaderData();
  const { pageTree } = useFumadocsLoader(data);
  const Content = clientLoader.getComponent(data.path) as unknown as ComponentType;
  const base = baseOptions();

  return (
    <DocsShellProvider tabs={data.tabs} activeTab={data.activeTab}>
      <DocsLayout
        {...base}
        nav={{ ...base.nav, mode: "top" }}
        tree={pageTree}
        tabs={false}
        sidebar={{ collapsible: false, footer: noFooter }}
        slots={{
          header: DocsHeader,
          ...(data.sidebar ? {} : { sidebar: noSidebar }),
        }}
      >
        <PageProvider url={data.url} filePath={data.path}>
          <Content />
        </PageProvider>
      </DocsLayout>
    </DocsShellProvider>
  );
}

import { LLMCopyButton, ViewOptions } from "@/components/page-actions";
import { PageProvider, usePageContext } from "@/lib/page-context";

function PageActions() {
  const { url, filePath } = usePageContext();
  const markdownUrl = `${url}.mdx`;
  const githubUrl = `https://github.com/nicholasgriffintn/paradoc/blob/main/apps/docs/${filePath}`;

  return (
    <div className="flex flex-row gap-2 items-center border-b border-fd-border pb-4 mb-6">
      <LLMCopyButton markdownUrl={markdownUrl} />
      <ViewOptions markdownUrl={markdownUrl} githubUrl={githubUrl} />
    </div>
  );
}
