// Relais vers l'API Claude, hébergé par Netlify (Edge Function).
// La clé API reste ici, côté serveur : l'appli et le site n'envoient que le « code famille ».
// Variables à définir dans Netlify (Site configuration > Environment variables) :
//   ANTHROPIC_API_KEY  : la clé API Claude
//   REVIZZ_CODE        : le code famille, saisi une fois sur chaque appareil
//   REVIZZ_ORIGINES    : (facultatif) autres adresses autorisées, séparées par des virgules

const MODELES = new Set(["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"]);
const MAX_TOKENS = 64000;

function entetesCors(req) {
  const origine = req.headers.get("origin") || "";
  const site = new URL(req.url).origin;
  const autres = (Netlify.env.get("REVIZZ_ORIGINES") || "").split(",").map((s) => s.trim()).filter(Boolean);
  // L'APK Android se présente comme https://localhost ; le site web, comme sa propre adresse.
  const autorisees = new Set([site, "https://localhost", "capacitor://localhost", ...autres]);
  return {
    "Access-Control-Allow-Origin": autorisees.has(origine) ? origine : site,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

// Comparaison à temps constant pour ne pas révéler le code famille.
function memeCode(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const erreur = (status, message, cors) =>
  new Response(JSON.stringify({ type: "error", error: { type: "revizz_error", message } }), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });

export default async (req) => {
  const cors = entetesCors(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return erreur(405, "Méthode non autorisée.", cors);

  const cle = Netlify.env.get("ANTHROPIC_API_KEY");
  const code = Netlify.env.get("REVIZZ_CODE");
  if (!cle || !code) return erreur(500, "Serveur Révizz pas encore configuré (clé API ou code famille manquant).", cors);
  if (!memeCode(req.headers.get("x-revizz-code") || "", code)) return erreur(401, "Code famille incorrect.", cors);

  // Seule la création de messages est relayée, avec les modèles de l'appli.
  const url = new URL(req.url);
  if (!url.pathname.endsWith("/v1/messages")) return erreur(404, "Adresse inconnue.", cors);
  let corps;
  try {
    corps = await req.json();
  } catch {
    return erreur(400, "Requête illisible.", cors);
  }
  if (!MODELES.has(corps.model)) return erreur(400, "Modèle non autorisé.", cors);
  if (!(corps.max_tokens > 0 && corps.max_tokens <= MAX_TOKENS)) return erreur(400, "max_tokens hors limites.", cors);

  const entetes = {
    "content-type": "application/json",
    "x-api-key": cle,
    "anthropic-version": req.headers.get("anthropic-version") || "2023-06-01",
  };
  const beta = req.headers.get("anthropic-beta");
  if (beta) entetes["anthropic-beta"] = beta;

  const amont = await fetch(`https://api.anthropic.com/v1/messages${url.search}`, {
    method: "POST",
    headers: entetes,
    body: JSON.stringify(corps),
  });
  // Le flux (streaming) est renvoyé tel quel, sans le mettre en mémoire.
  const h = new Headers(cors);
  for (const k of ["content-type", "request-id", "retry-after", "x-should-retry"]) {
    const v = amont.headers.get(k);
    if (v) h.set(k, v);
  }
  return new Response(amont.body, { status: amont.status, headers: h });
};

export const config = { path: "/api/claude/*" };
