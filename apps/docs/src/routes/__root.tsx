import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { RootProvider } from "fumadocs-ui/provider/tanstack";

import appCss from "../styles.css?url";

const meta = () => ({
  meta: [
    {
      charSet: "utf-8",
    },
    {
      name: "viewport",
      content: "width=device-width, initial-scale=1",
    },
    {
      title: "Paradoc",
    },
    {
      name: "description",
      content: "Documents as code for developers and AI agents",
    },
    // Open Graph
    {
      property: "og:type",
      content: "website",
    },
    {
      property: "og:title",
      content: "Paradoc Documentation",
    },
    {
      property: "og:description",
      content: "Documents as code for developers and AI agents",
    },
    {
      property: "og:image",
      content: "https://assets.paradoc.dev/paradoc-og-docs.png",
    },
    {
      property: "og:url",
      content: "https://docs.paradoc.dev",
    },
    // Twitter
    {
      name: "twitter:card",
      content: "summary_large_image",
    },
    {
      name: "twitter:title",
      content: "Paradoc Documentation",
    },
    {
      name: "twitter:description",
      content: "Documents as code for developers and AI agents",
    },
    {
      name: "twitter:image",
      content: "https://assets.paradoc.dev/paradoc-og-docs.png",
    },
  ],
  links: [
    {
      rel: "stylesheet",
      href: appCss,
    },
    {
      rel: "icon",
      href: "/favicon.ico",
    },
  ],
});

export const Route = createRootRoute({
  head: meta,
  component: RootDocument,
});

import { TanstackProvider } from "fumadocs-core/framework/tanstack";

function RootDocument() {
  return (
    <html lang="en" suppressHydrationWarning>
      <HeadContent />
      <body className="flex flex-col min-h-screen">
        <TanstackProvider>
          <RootProvider>
            <Outlet />
          </RootProvider>
        </TanstackProvider>
        <Scripts />
      </body>
    </html>
  );
}
