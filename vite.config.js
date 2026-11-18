import { defineConfig } from "vite";

// `npm run maquette` produit une seule page HTML (mode démo) pour essayer l'appli dans un navigateur.
export default defineConfig(({ mode }) => ({
  base: "./",
  build:
    mode === "maquette"
      ? { outDir: "dist-maquette", target: "es2020", assetsInlineLimit: 100000000, cssCodeSplit: false, rollupOptions: { output: { inlineDynamicImports: true } } }
      : { outDir: "dist", target: "es2020" },
}));
