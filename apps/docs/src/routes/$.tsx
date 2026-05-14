import { createFileRoute, notFound } from "@tanstack/react-router";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { createServerFn } from "@tanstack/react-start";
import { source, getPageImage } from "@/lib/source";
import browserCollections from "fumadocs-mdx:collections/browser";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { baseOptions } from "@/lib/layout.shared";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
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
        content: loaderData?.title ?? "Paradoc Documentation",
      },
      {
        property: "og:description",
        content: loaderData?.description ?? "Documents as code for developers and AI agents",
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
        content: loaderData?.title ?? "Paradoc Documentation",
      },
      {
        name: "twitter:description",
        content: loaderData?.description ?? "Documents as code for developers and AI agents",
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

    return {
      path: page.path,
      url: page.url,
      pageTree: await source.serializePageTree(source.getPageTree()),
      title: page.data.title,
      description: page.data.description,
      ogImageUrl: ogImage.url,
    };
  });

import { PageLastUpdate } from "fumadocs-ui/layouts/docs/page";

import {
  PropertiesTable,
  DesignTimeBadge,
  RunTimeBadge,
  MethodChain,
  MethodTable,
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
              Tab,
              Tabs,
            }}
          />
        </DocsBody>
      </DocsPage>
    );
  },
});

function Page() {
  const data = Route.useLoaderData();
  const { pageTree } = useFumadocsLoader(data);
  const Content = clientLoader.getComponent(data.path);

  return (
    <DocsLayout
      {...baseOptions()}
      tree={pageTree}
      sidebar={{
        banner: (
          <a
            href="https://paradoc.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-fd-muted-foreground hover:text-fd-foreground transition-colors"
          >
            paradoc.dev
            <ExternalLinkIcon className="size-3" />
          </a>
        ),
      }}
    >
      <PageProvider url={data.url} filePath={data.path}>
        <Content />
      </PageProvider>
    </DocsLayout>
  );
}

import { LLMCopyButton, ViewOptions } from "@/components/page-actions";

// import { createFileRoute, notFound } from "@tanstack/react-router";
// import { DocsLayout } from "fumadocs-ui/layouts/docs";
// import { createServerFn } from "@tanstack/react-start";
// import { source } from "@/lib/source";
// import browserCollections from 'fumadocs-mdx:collections/browser';
// import { createClientLoader } from "fumadocs-mdx/runtime/vite";
// import {
//   DocsBody,
//   DocsDescription,
//   DocsPage,
//   DocsTitle,
//   PageLastUpdate,
// } from "fumadocs-ui/layouts/docs/page";
// import defaultMdxComponents from "fumadocs-ui/mdx";
// import { baseOptions } from "@/lib/layout.shared";
// import { useFumadocsLoader } from "fumadocs-core/source/client";
// import { LLMCopyButton, ViewOptions } from "@/components/page-actions";
import { PageProvider, usePageContext } from "@/lib/page-context";

// export const Route = createFileRoute("/$")({
//   component: Page,
//   loader: async ({ params }) => {
//     const slugs = params._splat?.split("/") ?? [];
//     const data = await serverLoader({ data: slugs });
//     await clientLoader.preload(data.path);
//     return data;
//   },
//   notFoundComponent: () => {
//     // const data = Route.useLoaderData();
//     // const { pageTree } = useFumadocsLoader(data);

//     return (
//       <div>
//         <h1>This page doesn't exist!</h1>
//       </div>
//       // <DocsLayout {...baseOptions()} tree={pageTree}>
//       //   <PageProvider url={data.url} filePath={data.path}>
//       //     This page doesn't exist!
//       //   </PageProvider>
//       // </DocsLayout>
//     );
//   },
// });

// const serverLoader = createServerFn({
//   method: "GET",
// })
//   .inputValidator((slugs: string[]) => slugs)
//   .handler(async ({ data: slugs }) => {
//     const page = source.getPage(slugs);
//     if (!page) throw notFound();

//     return {
//       path: page.path,
//       url: page.url,
//       // filePath: page.file.path,
//       pageTree: await source.serializePageTree(source.getPageTree()),
//     };
//   });

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

// const clientLoader = createClientLoader(browserDocs.doc, {
//   id: "docs",
//   component({ toc, frontmatter, default: MDX, lastModified }) {
//     return (
//       <DocsPage toc={toc}>
//         <DocsTitle>{frontmatter.title}</DocsTitle>
//         <DocsDescription>{frontmatter.description}</DocsDescription>
//         The date... {String(lastModified)}
//         {lastModified && <PageLastUpdate date={lastModified} />}
//         <PageActions />
//         <DocsBody>
//           <MDX
//             components={{
//               ...defaultMdxComponents,
//             }}
//           />
//         </DocsBody>
//       </DocsPage>
//     );
//   },
// });

// function Page() {
//   const data = Route.useLoaderData();
//   const { pageTree } = useFumadocsLoader(data);
//   const Content = clientLoader.getComponent(data.path);

//   return (
//     <DocsLayout {...baseOptions()} tree={pageTree}>
//       <PageProvider url={data.url} filePath={data.path}>
//         <Content />
//       </PageProvider>
//     </DocsLayout>
//   );
// }
