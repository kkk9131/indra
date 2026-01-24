import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "esnext",
    lib: {
      entry: "src/index.ts",
      name: "IndraUI",
      fileName: (format) => `indra-ui.${format}.js`,
    },
  },
});
