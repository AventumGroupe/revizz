// Sauvegarde et synchronisation par fichier (Google Drive, e-mail…).
// Sur le téléphone : le menu de partage d'Android propose « Enregistrer dans Drive ».
// Sur le site web : le fichier est téléchargé, puis repris de l'autre côté avec « Reprendre une sauvegarde ».
import { Capacitor } from "@capacitor/core";
import { lire, ecrire } from "./store.js";
import { fusionJeu } from "./jeu.js";

// Tout ce qui fait le travail de l'élève. Les secrets (clé API, code famille) ne sont jamais exportés.
export const CLES = ["revizz.fiches", "revizz.stats", "revizz.matieres", "revizz.matieresMaj", "revizz.progres", "revizz.controles", "revizz.supprimes", "revizz.jeu"];
const KEY_SETTINGS = "revizz.settings";
const KEY_DERNIERE = "revizz.derniereSauvegarde";

export const derniereSauvegarde = () => lire(KEY_DERNIERE, null);

export function contenuSauvegarde() {
  const donnees = {};
  for (const k of CLES) {
    const v = lire(k, null);
    if (v !== null) donnees[k] = v;
  }
  const { prenom, classe, model } = lire(KEY_SETTINGS, {});
  donnees[KEY_SETTINGS] = { prenom, classe, model };
  return { app: "revizz", version: 1, date: new Date().toISOString(), donnees };
}

/** Crée le fichier et l'envoie (partage Android) ou le télécharge (web). */
export async function sauvegarder() {
  const json = JSON.stringify(contenuSauvegarde());
  const nom = `revizz-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const { uri } = await Filesystem.writeFile({ path: nom, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: "Sauvegarde Révizz", dialogTitle: "Enregistrer la sauvegarde (choisis Drive)", files: [uri] });
  } else {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: nom });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  ecrire(KEY_DERNIERE, Date.now());
  return nom;
}

/** Vérifie qu'un texte est bien une sauvegarde Révizz et la renvoie. */
export function lireSauvegarde(texte) {
  let s;
  try {
    s = JSON.parse(texte);
  } catch {
    throw new Error("Ce fichier n'est pas une sauvegarde Révizz.");
  }
  if (s?.app !== "revizz" || typeof s.donnees !== "object") throw new Error("Ce fichier n'est pas une sauvegarde Révizz.");
  return s;
}

const dates = (p) => [p?.maj, p?.depart?.date, ...(p?.finals || []).map((f) => f.date)].filter(Boolean);
const activite = (p) => (p ? Math.max(0, ...dates(p)) : 0);
const fraicheur = (x) => x?.maj || x?.cree || 0;
const QUATRE_VINGT_DIX_JOURS = 90 * 864e5;

/**
 * Fusionne deux jeux de données (cet appareil et un autre) sans rien perdre :
 * pour une même fiche ou un même contrôle, la version la plus récente gagne ; ce qui a été supprimé
 * après sa dernière modification reste supprimé. Fonction pure : ne touche pas au stockage.
 */
export function fusionDonnees(a = {}, b = {}) {
  const bilan = { ajoutees: 0, majs: 0 };
  const out = { ...a };
  // Suppressions : on garde la plus récente, et on oublie celles de plus de 90 jours.
  const sup = { ...(a["revizz.supprimes"] || {}) };
  for (const [k, t] of Object.entries(b["revizz.supprimes"] || {})) if (!(sup[k] >= t)) sup[k] = t;
  for (const k in sup) if (Date.now() - sup[k] > QUATRE_VINGT_DIX_JOURS) delete sup[k];
  out["revizz.supprimes"] = sup;
  const vivant = (type, x) => !(sup[`${type}:${x.id}`] >= fraicheur(x));

  const parId = new Map((a["revizz.fiches"] || []).map((f) => [f.id, f]));
  for (const f of b["revizz.fiches"] || []) {
    const ici = parId.get(f.id);
    if (!ici) {
      parId.set(f.id, f);
      if (vivant("fiche", f)) bilan.ajoutees++;
    } else if (fraicheur(f) > fraicheur(ici)) {
      parId.set(f.id, f);
      bilan.majs++;
    }
  }
  out["revizz.fiches"] = [...parId.values()].filter((f) => vivant("fiche", f)).sort((x, y) => (y.cree || 0) - (x.cree || 0));

  const progres = { ...(a["revizz.progres"] || {}) };
  for (const [k, p] of Object.entries(b["revizz.progres"] || {})) if (activite(p) > activite(progres[k])) progres[k] = p;
  out["revizz.progres"] = progres;

  // Matières : la liste modifiée le plus récemment gagne ; sans date, on ajoute celles qui manquent.
  if (b["revizz.matieres"]) {
    const ta = a["revizz.matieresMaj"] || 0, tb = b["revizz.matieresMaj"] || 0;
    if (!a["revizz.matieres"] || tb > ta) {
      out["revizz.matieres"] = b["revizz.matieres"];
      out["revizz.matieresMaj"] = tb;
    } else if (!ta && !tb) {
      const liste = [...a["revizz.matieres"]];
      for (const m of b["revizz.matieres"]) if (!liste.some((x) => x.nom === m.nom)) liste.push(m);
      out["revizz.matieres"] = liste;
    }
  }

  const ctrl = new Map((a["revizz.controles"] || []).map((c) => [c.id, c]));
  for (const c of b["revizz.controles"] || []) if (!ctrl.has(c.id) || fraicheur(c) > fraicheur(ctrl.get(c.id))) ctrl.set(c.id, c);
  out["revizz.controles"] = [...ctrl.values()].filter((c) => vivant("controle", c));

  if (b["revizz.jeu"]) out["revizz.jeu"] = fusionJeu(a["revizz.jeu"], b["revizz.jeu"]);
  const st = a["revizz.stats"], st2 = b["revizz.stats"];
  if (st2) {
    const base = st || { serie: 0, dernierJour: null, cartesRevisees: 0, qcmFaits: 0 };
    out["revizz.stats"] = {
      serie: Math.max(base.serie || 0, st2.serie || 0),
      dernierJour: [base.dernierJour, st2.dernierJour].filter(Boolean).sort().pop() || null,
      cartesRevisees: Math.max(base.cartesRevisees || 0, st2.cartesRevisees || 0),
      qcmFaits: Math.max(base.qcmFaits || 0, st2.qcmFaits || 0),
    };
  }
  // Prénom et classe : repris s'ils ne sont pas encore renseignés ici.
  const r1 = a[KEY_SETTINGS] || {}, r2 = b[KEY_SETTINGS] || {};
  out[KEY_SETTINGS] = { prenom: r1.prenom || r2.prenom || "", classe: r1.prenom ? r1.classe : r2.classe || r1.classe, model: r1.model || r2.model };
  return { donnees: out, bilan };
}

/** Données de cet appareil, au format des sauvegardes. */
export function donneesLocales() {
  return contenuSauvegarde().donnees;
}

/** Écrit des données fusionnées sur cet appareil (sans toucher aux réglages de connexion). */
export function appliquerDonnees(d) {
  for (const k of CLES) if (d[k] !== undefined) ecrire(k, d[k]);
  const reg = lire(KEY_SETTINGS, {});
  const r2 = d[KEY_SETTINGS] || {};
  ecrire(KEY_SETTINGS, { ...reg, prenom: reg.prenom || r2.prenom || "", classe: reg.prenom ? reg.classe : r2.classe || reg.classe });
}

/**
 * Reprend une sauvegarde.
 * - "fusionner" : garde tout ce qui est sur l'appareil et ajoute ce qui manque ; pour une même fiche, la plus récente gagne.
 * - "remplacer" : l'appareil devient une copie exacte de la sauvegarde.
 * Renvoie un petit bilan pour l'afficher.
 */
export function reprendre(sauvegarde, mode) {
  const d = sauvegarde.donnees;
  if (mode === "remplacer") {
    const vides = { "revizz.fiches": [], "revizz.progres": {}, "revizz.controles": [], "revizz.stats": { serie: 0, dernierJour: null, cartesRevisees: 0, qcmFaits: 0 } };
    for (const k of CLES) {
      if (d[k] !== undefined) ecrire(k, d[k]);
      else if (vides[k]) ecrire(k, vides[k]); // les matières restent celles de l'appareil si la sauvegarde n'en a pas
    }
    const reg = lire(KEY_SETTINGS, {});
    const r2 = d[KEY_SETTINGS] || {};
    ecrire(KEY_SETTINGS, { ...reg, prenom: reg.prenom || r2.prenom || "", classe: reg.prenom ? reg.classe : r2.classe || reg.classe });
    return { ajoutees: (d["revizz.fiches"] || []).length, majs: 0 };
  }
  const { donnees, bilan } = fusionDonnees(donneesLocales(), d);
  appliquerDonnees(donnees);
  return bilan;
}
