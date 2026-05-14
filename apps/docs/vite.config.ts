import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import mdx from "fumadocs-mdx/vite";
import * as MdxConfig from "./source.config";

const config = defineConfig({
  ssr: {
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom/server",
        "lucide-react",
        "fumadocs-core/source",
        "fumadocs-mdx/runtime/server",
      ],
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
