// Regroupe la maquette (HTML + CSS + JS) en un seul fichier : dist-maquette/revizz-maquette.html
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
const dir = "dist-maquette/assets";
const files = readdirSync(dir);
const css = files.filter((f) => f.endsWith(".css")).map((f) => readFileSync(`${dir}/${f}`, "utf8")).join("\n");
const js = files.filter((f) => f.endsWith(".js")).map((f) => readFileSync(`${dir}/${f}`, "utf8")).join("\n");
const page = `<title>Révizz</title>
<style>${css}</style>
<main id="app"></main>
<script type="module">${js.replace(/<\/script/gi, "<\\/script").replace(/\uFFFD/g, "\\uFFFD")}</script>
`;
writeFileSync("dist-maquette/revizz-maquette.html", page);
console.log("dist-maquette/revizz-maquette.html", Math.round(page.length / 1024), "Ko");
