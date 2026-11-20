// Synchronisation des fiches entre le téléphone et le site web, stockées dans Netlify Blobs.
// Protégée par le même code famille que le relais Claude (variable REVIZZ_CODE).
// Les données arrivent compressées (gzip) depuis l'appli et sont gardées telles quelles :
// le serveur ne lit pas les fiches, il garde seulement un numéro de version pour éviter qu'un appareil écrase l'autre.
import { getStore } from "@netlify/blobs";

const CLE = "famille";
const TAILLE_MAX = 5_500_000; // limite des fonctions Netlify : environ 6 Mo par requête

function entetesCors(req) {
  const origine = req.headers.get("origin") || "";
  const site = new URL(req.url).origin;
  const autres = (process.env.REVIZZ_ORIGINES || "").split(",").map((s) => s.trim()).filter(Boolean);
  const autorisees = new Set([site, "https://localhost", "capacitor://localhost", ...autres]);
  return {
    "Access-Control-Allow-Origin": autorisees.has(origine) ? origine : site,
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Expose-Headers": "x-revizz-rev, x-revizz-date",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

function memeCode(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const json = (status, corps, cors) => new Response(JSON.stringify(corps), { status, headers: { ...cors, "content-type": "application/json" } });

export default async (req) => {
  const cors = entetesCors(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const code = process.env.REVIZZ_CODE;
  if (!code) return json(500, { erreur: "Code famille (REVIZZ_CODE) non configuré sur Netlify." }, cors);
  if (!memeCode(req.headers.get("x-revizz-code") || "", code)) return json(401, { erreur: "Code famille incorrect." }, cors);

  const store = getStore({ name: "revizz-sync", consistency: "strong" });
  const actuel = await store.getMetadata(CLE);
  const rev = Number(actuel?.metadata?.rev || 0);

  if (req.method === "GET") {
    if (!rev) return new Response(null, { status: 204, headers: { ...cors, "x-revizz-rev": "0" } });
    const donnees = await store.get(CLE, { type: "arrayBuffer", consistency: "strong" });
    return new Response(donnees, {
      status: 200,
      headers: { ...cors, "content-type": "application/octet-stream", "x-revizz-rev": String(rev), "x-revizz-date": String(actuel.metadata.date || "") },
    });
  }

  if (req.method === "PUT") {
    // L'appareil dit sur quelle version il s'est basé ; si un autre a écrit entre-temps, il doit refusionner.
    const base = Number(req.headers.get("x-revizz-rev") ?? -1);
    if (base !== rev) return json(409, { erreur: "Version dépassée", rev }, cors);
    const corps = await req.arrayBuffer();
    if (!corps.byteLength) return json(400, { erreur: "Données vides." }, cors);
    if (corps.byteLength > TAILLE_MAX) return json(413, { erreur: "Trop de données pour la synchronisation." }, cors);
    const suivante = rev + 1;
    const date = Date.now();
    // Écriture conditionnelle : si un autre appareil a écrit au même instant, l'un des deux recommence.
    const cond = actuel?.etag ? { onlyIfMatch: actuel.etag } : { onlyIfNew: true };
    const res = await store.set(CLE, corps, { metadata: { rev: suivante, date }, ...cond });
    if (!res.modified) return json(409, { erreur: "Version dépassée", rev }, cors);
    return json(200, { rev: suivante, date }, cors);
  }

  return json(405, { erreur: "Méthode non autorisée." }, cors);
};

export const config = { path: "/api/sync" };
