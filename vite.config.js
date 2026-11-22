import { defineConfig } from "vite";

// `npm run maquette` produit une seule page HTML (mode démo) pour essayer l'appli dans un navigateur.
// Numéro de version affiché dans le Profil : celui de l'APK (GitHub Actions), sinon le commit déployé par Netlify.
const version = process.env.VITE_APP_VERSION || (process.env.COMMIT_REF ? `web ${process.env.COMMIT_REF.slice(0, 7)}` : "dev");
const dateBuild = new Date().toISOString().slice(0, 10);

export default defineConfig(({ mode }) => ({
  base: "./",
  define: { __VERSION__: JSON.stringify(version), __DATE_BUILD__: JSON.stringify(dateBuild) },
  build:
    mode === "maquette"
      ? { outDir: "dist-maquette", target: "es2020", assetsInlineLimit: 100000000, cssCodeSplit: false, rollupOptions: { output: { inlineDynamicImports: true } } }
      : { outDir: "dist", target: "es2020" },
}));
