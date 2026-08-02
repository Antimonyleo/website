import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://antimonyleo.github.io",
  base: "/website",
  output: "static",
  devToolbar: {
    enabled: false,
  },
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      theme: "github-dark-default",
    },
  },
});
