// Sauvegarde et synchronisation par fichier (Google Drive, e-mail…).
// Sur le téléphone : le menu de partage d'Android propose « Enregistrer dans Drive ».
// Sur le site web : le fichier est téléchargé, puis repris de l'autre côté avec « Reprendre une sauvegarde ».
import { Capacitor } from "@capacitor/core";
import { lire, ecrire } from "./store.js";

// Tout ce qui fait le travail de l'élève. Les secrets (clé API, code famille) ne sont jamais exportés.
const CLES = ["revizz.fiches", "revizz.stats", "revizz.matieres", "revizz.progres", "revizz.controles"];
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

const activite = (p) => Math.max(p?.depart?.date || 0, ...(p?.finals || []).map((f) => f.date || 0));
const fraicheur = (x) => x?.maj || x?.cree || 0;

/**
 * Reprend une sauvegarde.
 * - "fusionner" : garde tout ce qui est sur l'appareil et ajoute ce qui manque ; pour une même fiche, la plus récente gagne.
 * - "remplacer" : l'appareil devient une copie exacte de la sauvegarde.
 * Renvoie un petit bilan pour l'afficher.
 */
export function reprendre(sauvegarde, mode) {
  const d = sauvegarde.donnees;
  const bilan = { ajoutees: 0, majs: 0 };
  if (mode === "remplacer") {
    const vides = { "revizz.fiches": [], "revizz.progres": {}, "revizz.controles": [], "revizz.stats": { serie: 0, dernierJour: null, cartesRevisees: 0, qcmFaits: 0 } };
    for (const k of CLES) {
      if (d[k] !== undefined) ecrire(k, d[k]);
      else if (vides[k]) ecrire(k, vides[k]); // les matières restent celles de l'appareil si la sauvegarde n'en a pas
    }
    bilan.ajoutees = (d["revizz.fiches"] || []).length;
  } else {
    // Fiches : par identifiant, la version la plus récente gagne.
    const locales = lire("revizz.fiches", []);
    const parId = new Map(locales.map((f) => [f.id, f]));
    for (const f of d["revizz.fiches"] || []) {
      const ici = parId.get(f.id);
      if (!ici) {
        parId.set(f.id, f);
        bilan.ajoutees++;
      } else if (fraicheur(f) > fraicheur(ici)) {
        parId.set(f.id, f);
        bilan.majs++;
      }
    }
    ecrire("revizz.fiches", [...parId.values()].sort((a, b) => (b.cree || 0) - (a.cree || 0)));

    // Progrès par chapitre : on garde celui qui a l'activité la plus récente.
    const progres = lire("revizz.progres", {});
    for (const [k, p] of Object.entries(d["revizz.progres"] || {})) if (activite(p) > activite(progres[k])) progres[k] = p;
    ecrire("revizz.progres", progres);

    // Matières : on ajoute celles qui manquent.
    const mats = lire("revizz.matieres", null);
    if (d["revizz.matieres"]) {
      const liste = mats ?? [];
      for (const m of d["revizz.matieres"]) if (!liste.some((x) => x.nom === m.nom)) liste.push(m);
      ecrire("revizz.matieres", liste);
    }

    // Contrôles : par identifiant, le plus récent gagne.
    const ctrl = new Map(lire("revizz.controles", []).map((c) => [c.id, c]));
    for (const c of d["revizz.controles"] || []) if (!ctrl.has(c.id) || fraicheur(c) > fraicheur(ctrl.get(c.id))) ctrl.set(c.id, c);
    ecrire("revizz.controles", [...ctrl.values()]);

    // Série et compteurs : on garde le meilleur.
    const st = lire("revizz.stats", null);
    const st2 = d["revizz.stats"];
    if (st2) {
      const base = st || { serie: 0, dernierJour: null, cartesRevisees: 0, qcmFaits: 0 };
      ecrire("revizz.stats", {
        serie: Math.max(base.serie || 0, st2.serie || 0),
        dernierJour: [base.dernierJour, st2.dernierJour].filter(Boolean).sort().pop() || null,
        cartesRevisees: Math.max(base.cartesRevisees || 0, st2.cartesRevisees || 0),
        qcmFaits: Math.max(base.qcmFaits || 0, st2.qcmFaits || 0),
      });
    }
  }
  // Prénom et classe : repris s'ils ne sont pas encore renseignés ici.
  const reg = lire(KEY_SETTINGS, {});
  const r2 = d[KEY_SETTINGS] || {};
  ecrire(KEY_SETTINGS, { ...reg, prenom: reg.prenom || r2.prenom || "", classe: reg.prenom ? reg.classe : r2.classe || reg.classe });
  return bilan;
}
