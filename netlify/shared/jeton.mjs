// Jetons de connexion Révizz : signés (HMAC-SHA256), vérifiables sans base de données,
// par la fonction de compte, la synchronisation et le relais Claude.
// Le secret vient de REVIZZ_SECRET s'il existe, sinon de la clé API et du code famille :
// changer le code famille déconnecte donc tous les appareils.
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

export const secretSite = (env) => env("REVIZZ_SECRET") || `${env("ANTHROPIC_API_KEY") || ""}|${env("REVIZZ_CODE") || ""}`;

async function cle(secret) {
  const brut = await crypto.subtle.digest("SHA-256", enc.encode(`revizz-jeton|${secret}`));
  return crypto.subtle.importKey("raw", brut, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/** Crée un jeton valable `jours` jours. */
export async function signer(donnees, secret, jours = 120) {
  const corps = b64u(enc.encode(JSON.stringify({ ...donnees, exp: Date.now() + jours * 864e5 })));
  const sig = b64u(await crypto.subtle.sign("HMAC", await cle(secret), enc.encode(corps)));
  return `${corps}.${sig}`;
}

/** Renvoie le contenu du jeton s'il est authentique et pas expiré, sinon null. */
export async function verifier(jeton, secret) {
  try {
    const [corps, sig] = String(jeton || "").split(".");
    if (!corps || !sig) return null;
    const ok = await crypto.subtle.verify("HMAC", await cle(secret), deb64u(sig), enc.encode(corps));
    if (!ok) return null;
    const d = JSON.parse(new TextDecoder().decode(deb64u(corps)));
    return d.exp > Date.now() ? d : null;
  } catch {
    return null;
  }
}

/** Comparaison à temps constant (codes, empreintes). */
export function memeTexte(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** En-têtes CORS communs (l'APK se présente comme https://localhost). */
export function entetesCors(req, env, methodes) {
  const origine = req.headers.get("origin") || "";
  const site = new URL(req.url).origin;
  const autres = (env("REVIZZ_ORIGINES") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const autorisees = new Set([site, "https://localhost", "capacitor://localhost", ...autres]);
  return {
    "Access-Control-Allow-Origin": autorisees.has(origine) ? origine : site,
    "Access-Control-Allow-Methods": methodes,
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Expose-Headers": "x-revizz-rev, x-revizz-date",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}
