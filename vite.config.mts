import { defineConfig } from "vite";

export default defineConfig({
  root: "src/viewer",
  base: "./",
  build: {
    outDir: "../../dist/viewer",
    emptyOutDir: true,
    sourcemap: true,
  },
});
