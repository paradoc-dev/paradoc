import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { defineConfig, searchForWorkspaceRoot } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import mdx from "fumadocs-mdx/vite";
import * as MdxConfig from "./source.config";

const require = createRequire(import.meta.url);

// The font packages resolve into the pnpm store of the enclosing monorepo,
// which sits above the nearest workspace root (paradoc/ carries its own
// pnpm-workspace.yaml for the public repo). Vite's serving allow list stops at
// that nearer root, so the store paths are added explicitly.
function packageDir(name: string): string {
  return path.dirname(realpathSync(require.resolve(`${name}/package.json`)));
}

// Every third-party module the app or its MDX content imports, pre-bundled
// up front. The SSR environment runs in workerd, whose module runner keeps
// the modules it has already evaluated when Vite re-optimizes mid-session.
// A late discovery (a page importing something not yet bundled) then yields
// two React instances and "Invalid hook call". Listing the full set means the
// first optimization is the last one.
const optimizedDeps = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "@base-ui/react/button",
  "@base-ui/react/dialog",
  "@base-ui/react/popover",
  "@base-ui/react/scroll-area",
  "class-variance-authority",
  "clsx",
  "fumadocs-core/framework",
  "fumadocs-core/framework/tanstack",
  "fumadocs-core/link",
  "fumadocs-core/negotiation",
  "fumadocs-core/page-tree",
  "fumadocs-core/search/server",
  "fumadocs-core/source",
  "fumadocs-core/source/client",
  "fumadocs-mdx/runtime/browser",
  "fumadocs-mdx/runtime/server",
  "fumadocs-ui/components/dynamic-codeblock",
  "fumadocs-ui/components/sidebar/base",
  "fumadocs-ui/components/steps",
  "fumadocs-ui/components/tabs",
  "fumadocs-ui/contexts/search",
  "fumadocs-ui/contexts/tree",
  "fumadocs-ui/layouts/notebook",
  "fumadocs-ui/layouts/notebook/page",
  "fumadocs-ui/layouts/shared",
  "fumadocs-ui/mdx",
  "fumadocs-ui/provider/tanstack",
  "fumadocs-ui/utils/use-copy-button",
  "lucide-react",
  "pdfjs-dist",
  "pdfjs-dist/build/pdf.worker.mjs",
  "tailwind-merge",
  "workers-og",
  "zod",
  // Pulled in through linked workspace packages, so they resolve from those
  // packages rather than from this app.
  "@paradoc/components > qrcode.react",
  "@paradoc/core > safe-regex",
  "@paradoc/core > yaml",
  "@paradoc/render > fflate",
];

const config = defineConfig({
  define: {
    __PARADOC_DOCS_PLATFORM_API__: JSON.stringify(
      process.env.PARADOC_DOCS_PLATFORM_API === "true",
    ),
  },
  server: {
    fs: {
      allow: [
        searchForWorkspaceRoot(process.cwd()),
        packageDir("@fontsource-variable/geist"),
        packageDir("@fontsource-variable/geist-mono"),
      ],
    },
  },
  optimizeDeps: {
    include: [...optimizedDeps, "react-dom/client"],
  },
  ssr: {
    optimizeDeps: {
      include: [...optimizedDeps, "react-dom/server"],
    },
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    mdx(MdxConfig),
    tailwindcss(),
    tanstackStart({
      prerender: {
        enabled: true,
        crawlLinks: true, // Discovers all linkable pages
        // OG images are generated at runtime by the Worker with caching
      },
      router: {
        routeFileIgnorePrefix: "components",
      },
      sitemap: {
        enabled: true,
        host: 'https://docs.paradoc.dev',
      },
    }),
    viteReact(),
  ],
});

export default config;
