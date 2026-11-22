// Comptes élèves : identifiant + mot de passe, stockés dans Netlify Blobs.
// - La création d'un compte demande le code famille (REVIZZ_CODE) : seule la famille peut créer des comptes
//   et donc utiliser la clé Claude du site.
// - Les mots de passe ne sont jamais gardés : seulement une empreinte scrypt salée.
// - Trop d'essais ratés bloquent le compte 15 minutes.
// - Un parent peut réinitialiser un mot de passe oublié avec le code famille.
import { getStore } from "@netlify/blobs";
import { scrypt, randomBytes, timingSafeEqual, randomUUID } from "node:crypto";
import { signer, verifier, secretSite, memeTexte, entetesCors } from "../shared/jeton.mjs";
import { entetesCors as entetesCorsCommun } from "../shared/jeton.mjs";

const env = (k) => process.env[k];
const IDENT = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const MAX_ECHECS = 8;
const BLOCAGE = 15 * 60 * 1000;

const empreinte = (mdp, sel) =>
  new Promise((res, rej) => scrypt(mdp, sel, 32, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? rej(e) : res(k))));
async function hacher(mdp) {
  const sel = randomBytes(16);
  return { sel: sel.toString("base64"), hash: (await empreinte(mdp, sel)).toString("base64") };
}
async function verifierMdp(mdp, compte) {
  const k = await empreinte(mdp, Buffer.from(compte.sel, "base64"));
  const attendu = Buffer.from(compte.hash, "base64");
  return k.length === attendu.length && timingSafeEqual(k, attendu);
}
const normaliser = (s) => String(s || "").trim().toLowerCase();
const mdpValide = (m) => typeof m === "string" && m.length >= 8 && m.length <= 200;

async function traiter(req) {
  const cors = entetesCors(req, env, "GET, POST, OPTIONS");
  const json = (status, corps) => new Response(JSON.stringify(corps), { status, headers: { ...cors, "content-type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const code = env("REVIZZ_CODE");
  if (!code) return json(500, { erreur: "Code famille (REVIZZ_CODE) non configuré sur Netlify." });
  const secret = secretSite(env);
  const comptes = getStore({ name: "revizz-comptes", consistency: "strong" });
  const action = new URL(req.url).pathname.split("/").pop();
  let corps = {};
  if (req.method === "POST") {
    try {
      corps = await req.json();
    } catch {
      return json(400, { erreur: "Requête illisible." });
    }
  }
  const lire = (id) => comptes.get(`u/${id}`, { type: "json" });
  const ecrire = (c) => comptes.setJSON(`u/${c.identifiant}`, c);
  const jetonPour = (c) => signer({ u: c.id, i: c.identifiant, g: c.gen || 0 }, secret);
  const reponseCompte = async (c) => json(200, { jeton: await jetonPour(c), identifiant: c.identifiant, id: c.id });

  if (action === "inscription" && req.method === "POST") {
    if (!memeTexte(String(corps.code || ""), code)) return json(401, { erreur: "Code famille incorrect : demande-le à un parent." });
    const identifiant = normaliser(corps.identifiant);
    if (!IDENT.test(identifiant)) return json(400, { erreur: "Identifiant : 3 à 30 caractères, lettres minuscules, chiffres, point, tiret ou tiret bas." });
    if (!mdpValide(corps.motdepasse)) return json(400, { erreur: "Le mot de passe doit faire au moins 8 caractères." });
    if (await lire(identifiant)) return json(409, { erreur: "Cet identifiant est déjà pris." });
    const c = { id: randomUUID(), identifiant, ...(await hacher(corps.motdepasse)), cree: Date.now(), gen: 0, echecs: 0 };
    const r = await comptes.setJSON(`u/${identifiant}`, c, { onlyIfNew: true });
    if (r && r.modified === false) return json(409, { erreur: "Cet identifiant est déjà pris." });
    return reponseCompte(c);
  }

  if (action === "connexion" && req.method === "POST") {
    const identifiant = normaliser(corps.identifiant);
    const c = IDENT.test(identifiant) ? await lire(identifiant) : null;
    // Même message que le compte existe ou non, pour ne rien révéler.
    if (!c) return json(401, { erreur: "Identifiant ou mot de passe incorrect." });
    if (c.bloqueJusqua && c.bloqueJusqua > Date.now()) return json(429, { erreur: "Trop d'essais ratés : réessaie dans 15 minutes, ou demande à un parent de réinitialiser le mot de passe." });
    if (!(await verifierMdp(String(corps.motdepasse || ""), c))) {
      c.echecs = (c.echecs || 0) + 1;
      if (c.echecs >= MAX_ECHECS) Object.assign(c, { echecs: 0, bloqueJusqua: Date.now() + BLOCAGE });
      await ecrire(c);
      return json(401, { erreur: "Identifiant ou mot de passe incorrect." });
    }
    if (c.echecs || c.bloqueJusqua) await ecrire({ ...c, echecs: 0, bloqueJusqua: 0 });
    return reponseCompte(c);
  }

  if (action === "reinitialiser" && req.method === "POST") {
    if (!memeTexte(String(corps.code || ""), code)) return json(401, { erreur: "Code famille incorrect." });
    const c = await lire(normaliser(corps.identifiant));
    if (!c) return json(404, { erreur: "Aucun compte avec cet identifiant." });
    if (!mdpValide(corps.motdepasse)) return json(400, { erreur: "Le mot de passe doit faire au moins 8 caractères." });
    // Nouveau mot de passe : les anciens jetons ne marchent plus (synchronisation et compte).
    Object.assign(c, await hacher(corps.motdepasse), { gen: (c.gen || 0) + 1, echecs: 0, bloqueJusqua: 0 });
    await ecrire(c);
    return json(200, { ok: true });
  }

  // Actions de l'élève connecté
  const jeton = await verifier(req.headers.get("x-revizz-jeton"), secret);
  if (!jeton) return json(401, { erreur: "Session expirée : reconnecte-toi." });
  const c = await lire(jeton.i);
  if (!c || c.id !== jeton.u || (c.gen || 0) !== (jeton.g || 0)) return json(401, { erreur: "Session expirée : reconnecte-toi." });

  if (action === "moi" && req.method === "GET") return json(200, { identifiant: c.identifiant, cree: c.cree });

  if (action === "motdepasse" && req.method === "POST") {
    if (!(await verifierMdp(String(corps.ancien || ""), c))) return json(401, { erreur: "Mot de passe actuel incorrect." });
    if (!mdpValide(corps.nouveau)) return json(400, { erreur: "Le nouveau mot de passe doit faire au moins 8 caractères." });
    Object.assign(c, await hacher(corps.nouveau), { gen: (c.gen || 0) + 1 });
    await ecrire(c);
    return reponseCompte(c); // nouveau jeton pour cet appareil ; les autres devront se reconnecter
  }

  return json(404, { erreur: "Action inconnue." });
};


// Toute erreur imprévue renvoie quand même les en-têtes CORS : l'appli peut afficher le vrai message.
export default async (req) => {
  try {
    return await traiter(req);
  } catch (e) {
    const cors = entetesCorsCommun(req, (k) => process.env[k], "GET, POST, OPTIONS");
    return new Response(JSON.stringify({ erreur: `Erreur du serveur Révizz : ${e?.message || e}` }), { status: 500, headers: { ...cors, "content-type": "application/json" } });
  }
};

export const config = { path: "/api/compte/*" };
