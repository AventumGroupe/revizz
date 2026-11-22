// Compte élève : identifiant + mot de passe, valable sur le téléphone et sur le site web.
// Le jeton de connexion est gardé sur l'appareil (jamais le mot de passe).
import { getSettings, saveSettings, ecrire } from "./store.js";
import { adresseServeur } from "./claude.js";
import { CLES } from "./sauvegarde.js";

async function appel(action, { corps, methode = "POST", jeton, serveur } = {}) {
  const base = serveur || adresseServeur();
  if (!base) throw new Error("Indique d'abord l'adresse du site Révizz.");
  let r;
  try {
    r = await fetch(`${base}/api/compte/${action}`, {
      method: methode,
      headers: { "content-type": "application/json", ...(jeton ? { "x-revizz-jeton": jeton } : {}) },
      body: corps ? JSON.stringify(corps) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new Error(navigator.onLine === false ? "Pas de connexion internet." : "Impossible de joindre le site Révizz : vérifie son adresse.");
  }
  if (r.status === 404 && !(await r.clone().json().catch(() => null))?.erreur) throw new Error("Le site Révizz n'a pas encore les comptes : mets-le à jour sur Netlify.");
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erreur || `Erreur ${r.status}`);
  return d;
}

const enregistrer = (d, serveur) =>
  saveSettings({ connexion: "compte", jeton: d.jeton, identifiant: d.identifiant, demo: false, ...(serveur ? { serveur } : {}) });

export const estConnecte = (s = getSettings()) => s.connexion === "compte" && !!s.jeton;

export async function connexion(identifiant, motdepasse, serveur) {
  enregistrer(await appel("connexion", { corps: { identifiant, motdepasse }, serveur }), serveur);
}
export async function inscription(identifiant, motdepasse, code, serveur) {
  enregistrer(await appel("inscription", { corps: { identifiant, motdepasse, code }, serveur }), serveur);
}
export async function changerMotDePasse(ancien, nouveau) {
  const d = await appel("motdepasse", { corps: { ancien, nouveau }, jeton: getSettings().jeton });
  saveSettings({ jeton: d.jeton });
}
export async function reinitialiser(identifiant, motdepasse, code) {
  await appel("reinitialiser", { corps: { identifiant, motdepasse, code } });
}

/** Déconnexion : efface le travail de cet appareil (il reste sur le compte). */
export function deconnecter() {
  for (const k of [...CLES, "revizz.synchro", "revizz.jeuDemo", "revizz.conso"]) {
    try {
      localStorage.removeItem(k);
    } catch {}
  }
  ecrire("revizz.fiches", []);
  saveSettings({ jeton: "", identifiant: "", connexion: "compte", prenom: "" });
}
