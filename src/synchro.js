// Synchronisation automatique entre le téléphone et le site web, par le site Révizz (Netlify) et le code famille.
// À l'ouverture, au retour dans l'appli et quelques secondes après chaque modification :
// 1. on récupère la version du serveur ; 2. on la fusionne avec celle de l'appareil (la plus récente gagne fiche par fiche) ;
// 3. on renvoie le résultat si quelque chose a changé. Les données voyagent compressées.
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { getSettings, saveSettings, lire, ecrire, surModification } from "./store.js";
import { adresseServeur } from "./claude.js";
import { CLES, fusionDonnees, donneesLocales, appliquerDonnees } from "./sauvegarde.js";

const KEY_ETAT = "revizz.synchro"; // { rev, date, erreur }
const DELAI = 4000;
let minuteur = null;
let enCours = null;
let ecritureInterne = false;
let apresMaj = () => {};

export const etat = () => lire(KEY_ETAT, { rev: 0, date: null, erreur: null });
const majEtat = (e) => {
  ecritureInterne = true;
  try {
    ecrire(KEY_ETAT, { ...etat(), ...e });
  } finally {
    ecritureInterne = false;
  }
};

/** La synchro est possible : connexion par le site Révizz avec un code famille, hors démo. */
export function disponible(s = getSettings()) {
  const acces = s.connexion === "compte" ? !!s.jeton : s.connexion !== "cle" && !!s.code;
  return !s.demo && acces && !!adresseServeur(s) && typeof CompressionStream !== "undefined";
}
export const active = (s = getSettings()) => disponible(s) && s.synchro !== false;
export const activer = (oui) => saveSettings({ synchro: !!oui });

// Les exemples de la démo restent sur l'appareil.
function sansDemo(d) {
  const out = { ...d };
  if (out["revizz.fiches"]) out["revizz.fiches"] = out["revizz.fiches"].filter((f) => !f.demoKey);
  if (out["revizz.controles"]) out["revizz.controles"] = out["revizz.controles"].filter((c) => !c.demo);
  if (out["revizz.progres"]) out["revizz.progres"] = Object.fromEntries(Object.entries(out["revizz.progres"]).filter(([, p]) => !p.demo));
  return out;
}

async function compresser(obj) {
  const flux = new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(flux).arrayBuffer();
}
async function gunzip(buf) {
  const flux = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(flux).text());
}
// Tolérant : un serveur pas encore à jour a pu garder les données en base64 (envoi par la couche réseau Android).
async function decompresser(buf) {
  try {
    return await gunzip(buf);
  } catch (e) {
    try {
      const texte = new TextDecoder().decode(buf).trim();
      return await gunzip(Uint8Array.from(atob(texte), (c) => c.charCodeAt(0)));
    } catch {
      throw e;
    }
  }
}

const signature = (d) => JSON.stringify(CLES.map((k) => d[k] ?? null));

async function appel(methode, corps, rev) {
  const s = getSettings();
  const headers = s.connexion === "compte" ? { "x-revizz-jeton": s.jeton } : { "x-revizz-code": String(s.code || "").trim() };
  if (rev !== undefined) headers["x-revizz-rev"] = String(rev);
  if (corps) headers["content-type"] = "application/octet-stream";
  const url = `${adresseServeur(s)}/api/sync`;
  let r;
  try {
    r = await fetch(url, { method: methode, headers, body: corps, cache: "no-store" });
  } catch (e) {
    // Android : si le navigateur intégré bloque la requête, on passe par la couche réseau native (données en base64).
    if (!Capacitor.isNativePlatform()) throw e;
    const b64 = (buf) => btoa(Array.from(new Uint8Array(buf), (c) => String.fromCharCode(c)).join(""));
    const n = await CapacitorHttp.request({
      url,
      method: methode,
      headers: { ...headers, ...(corps ? { "content-type": "text/plain", "x-revizz-encodage": "base64" } : {}) },
      data: corps ? b64(corps) : undefined,
      responseType: methode === "GET" ? "arraybuffer" : "json",
    });
    const entetes = Object.fromEntries(Object.entries(n.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    let corpsRep = null;
    if (n.status !== 204) {
      if (methode === "GET" && n.status === 200 && typeof n.data === "string") corpsRep = Uint8Array.from(atob(n.data), (c) => c.charCodeAt(0));
      else corpsRep = typeof n.data === "string" ? n.data : JSON.stringify(n.data ?? {});
    }
    r = new Response(corpsRep, { status: n.status, headers: entetes });
  }
  if (r.status === 401 || r.status === 403) {
    const d = await r.clone().json().catch(() => ({}));
    if (!d.erreur) throw new Error("Le site Révizz est en accès privé sur Netlify : clique sur « Make public » dans Netlify.");
    throw new Error(s.connexion === "compte" ? "Session expirée : reconnecte-toi dans le Profil." : "Code famille refusé par le serveur.");
  }
  if (r.status === 404) throw new Error("Le site Révizz n'a pas encore la synchronisation : mets-le à jour sur Netlify.");
  return r;
}

async function unTour() {
  // 1. Version du serveur
  const r = await appel("GET");
  if (!r.ok && r.status !== 204) throw new Error((await r.json().catch(() => ({}))).erreur || `Erreur serveur ${r.status}`);
  const rev = Number(r.headers.get("x-revizz-rev") || 0);
  const distant = r.status === 204 ? null : (await decompresser(await r.arrayBuffer())).donnees;
  // 2. Fusion
  const locales = donneesLocales();
  const { donnees, bilan } = distant ? fusionDonnees(locales, distant) : { donnees: locales, bilan: { ajoutees: 0, majs: 0 } };
  const aEnvoyer = sansDemo(donnees);
  let changeIci = false;
  if (distant && signature(donnees) !== signature(locales)) {
    ecritureInterne = true;
    try {
      // On refusionne avec l'appareil tel qu'il est maintenant : ce que l'élève a fait pendant l'échange n'est pas perdu.
      appliquerDonnees(fusionDonnees(donneesLocales(), donnees).donnees);
    } finally {
      ecritureInterne = false;
    }
    changeIci = true;
  }
  // 3. Envoi si le serveur n'a pas déjà exactement ces données
  const surServeur = distant ? sansDemo(fusionDonnees(distant, {}).donnees) : null;
  if (!surServeur || signature(aEnvoyer) !== signature(surServeur)) {
    const p = await appel("PUT", await compresser({ app: "revizz", version: 1, donnees: aEnvoyer }), rev);
    if (p.status === 409) return { recommencer: true };
    if (!p.ok) throw new Error((await p.json().catch(() => ({}))).erreur || `Erreur serveur ${p.status}`);
    const { rev: nouvelle } = await p.json();
    majEtat({ rev: nouvelle, date: Date.now(), erreur: null });
  } else majEtat({ rev, date: Date.now(), erreur: null });
  return { changeIci, bilan };
}

/** Lance une synchronisation (une seule à la fois). Renvoie { changeIci, bilan } ou lève une erreur. */
export function synchroniser() {
  if (!disponible()) return Promise.resolve(null);
  if (enCours) return enCours;
  enCours = (async () => {
    try {
      for (let essai = 0; essai < 4; essai++) {
        const res = await unTour();
        if (!res.recommencer) {
          if (res.changeIci) apresMaj(res.bilan);
          return res;
        }
      }
      throw new Error("Le serveur est occupé, nouvel essai plus tard.");
    } catch (e) {
      majEtat({ erreur: navigator.onLine === false ? "Hors ligne : la synchronisation reprendra au retour du réseau." : e.message });
      throw e;
    } finally {
      enCours = null;
    }
  })();
  return enCours;
}

const plusTard = () => {
  if (!active()) return;
  clearTimeout(minuteur);
  minuteur = setTimeout(() => synchroniser().catch(() => {}), DELAI);
};

/** À appeler une fois au démarrage. apres(bilan) est appelé quand des données d'un autre appareil sont arrivées. */
export function demarrer(apres) {
  apresMaj = apres || apresMaj;
  surModification((cle) => {
    if (!ecritureInterne && CLES.includes(cle)) plusTard();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && active()) synchroniser().catch(() => {});
  });
  window.addEventListener("online", () => active() && synchroniser().catch(() => {}));
  if (active()) synchroniser().catch(() => {});
}
