// Mode « J'ai un contrôle » : planning de révision jour par jour + rappels sur le téléphone.
// Le planning est calculé sur l'appareil : aucun appel à Claude.
import { Capacitor } from "@capacitor/core";
import { lire, ecrire, getFiches, uid, getSettings } from "./store.js";

const KEY = "revizz.controles";
const JOUR = 864e5;
const HEURE_RAPPEL = 18; // rappel quotidien à 18 h

export const iso = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
export const aujourdhui = () => iso(Date.now());
const versDate = (s) => {
  const [a, m, j] = s.split("-").map(Number);
  return new Date(a, m - 1, j);
};
/** Nombre de jours entre aujourd'hui et la date du contrôle (0 = aujourd'hui). */
export const joursRestants = (c) => Math.round((versDate(c.date) - versDate(aujourdhui())) / JOUR);

export const getControles = () => lire(KEY, []);
export const getControle = (id) => getControles().find((c) => c.id === id);
export const aVenir = () => getControles().filter((c) => joursRestants(c) >= 0).sort((a, b) => a.date.localeCompare(b.date));
export const passes = () => getControles().filter((c) => joursRestants(c) < 0).sort((a, b) => b.date.localeCompare(a.date));

export function saveControle(c) {
  c.maj = Date.now();
  const all = getControles();
  const i = all.findIndex((x) => x.id === c.id);
  if (i >= 0) all[i] = c;
  else all.push(c);
  ecrire(KEY, all);
  return c;
}
export async function supprimerControlesDemo() {
  for (const c of getControles().filter((x) => x.demo)) await supprimerControle(c.id);
}
export async function supprimerControle(id) {
  await annulerRappels(getControle(id));
  ecrire(KEY, getControles().filter((c) => c.id !== id));
}
export function nouveauControle({ matiere, date, chapitres, titre }) {
  return saveControle({ id: uid(), matiere, date, chapitres, titre: titre || "", cree: Date.now(), faits: {}, note: null, demo: getSettings().demo || undefined });
}

const fichesDu = (c) =>
  getFiches()
    .filter((f) => f.matiere === c.matiere && (!c.chapitres.length || c.chapitres.includes(f.chapitre || "Sans chapitre")))
    .sort((a, b) => (a.cree || 0) - (b.cree || 0));

/**
 * Planning : d'aujourd'hui à la veille du contrôle.
 * - Tous les jours : les cartes à revoir.
 * - Les premiers jours : relire chaque fiche ; à partir du 2e jour : un QCM par jour (fiches en alternance).
 * - Préparation longue (6 jours ou plus) : un sujet blanc à mi-parcours.
 * - La veille : un sujet blanc type contrôle, un QCM bilan difficile et la relecture des points clés.
 * - Le jour J : relecture rapide et cartes.
 * L'élève peut retirer des tâches (c.retires) et en ajouter (c.extras, par jour).
 */
function planningDeBase(c) {
  const fiches = fichesDu(c);
  const reste = joursRestants(c);
  if (reste < 0) return [];
  const t = (date, type, f, label, action) => ({ id: `${date}|${type}|${f?.id || "tout"}`, type, label, action });
  const versFiche = (f, tab) => ({ vue: "fiche", ficheId: f.id, tab });
  const jours = [];
  for (let k = 0; k < Math.max(reste, 1); k++) jours.push(iso(versDate(aujourdhui()).getTime() + k * JOUR));
  const plan = jours.map((date) => ({ date, taches: [] }));
  if (reste === 0) {
    const d = plan[0].date;
    for (const f of fiches) plan[0].taches.push(t(d, "relire", f, `Relire les points clés : ${f.titre}`, versFiche(f, "resume")));
    plan[0].taches.push(t(d, "cartes", null, "Cartes à revoir (5 min)", { vue: "revision" }));
    return plan;
  }
  const n = plan.length;
  const travail = n > 1 ? n - 1 : 1; // jours avant la veille
  // Relectures réparties sur les premiers jours.
  fiches.forEach((f, i) => {
    const k = Math.min(travail - 1, Math.floor((i * travail) / fiches.length));
    plan[k].taches.push(t(plan[k].date, "relire", f, `Relire la fiche : ${f.titre}`, versFiche(f, "resume")));
  });
  // Un QCM par jour à partir du 2e jour de travail (ou dès le 1er s'il n'y en a qu'un), fiches en alternance.
  if (fiches.length)
    for (let k = travail > 1 ? 1 : 0; k < travail; k++) {
      const f = fiches[(k - 1 + fiches.length) % fiches.length];
      plan[k].taches.push(t(plan[k].date, "qcm", f, `QCM : ${f.titre}`, versFiche(f, "qcm")));
    }
  // Sujet blanc à mi-parcours pour les longues préparations.
  if (n >= 6 && fiches.length) {
    const k = Math.floor(travail / 2);
    const f = fiches[k % fiches.length];
    plan[k].taches.push(t(plan[k].date, "sujet", f, `Sujet blanc : ${f.titre}`, versFiche(f, "sujet")));
  }
  plan.forEach((p) => p.taches.push(t(p.date, "cartes", null, "Réviser les cartes à revoir", { vue: "revision" })));
  // La veille.
  const veille = plan[n - 1];
  if (fiches.length) {
    veille.taches.push(t(veille.date, "sujet", fiches[0], "Sujet blanc type contrôle", versFiche(fiches[0], "sujet")));
    if (n > 1) {
      const f = fiches[fiches.length - 1];
      veille.taches.push(t(veille.date, "qcm", f, `QCM bilan (difficile) : ${f.titre}`, { ...versFiche(f, "qcm"), niveau: "difficile" }));
      veille.taches.push(t(veille.date, "points", null, "Relire les points clés de toutes les fiches", { vue: "matiere" }));
    }
  }
  return plan;
}

const LIBELLES = { relire: "Relire la fiche", qcm: "QCM", sujet: "Sujet blanc", cartes: "Réviser les cartes à revoir", test: "Test final du chapitre" };
/** Tâche ajoutée par l'élève. */
export function ajouterTache(c, date, type, fiche) {
  const tache = {
    id: `${date}|x|${uid()}`,
    type,
    label: fiche && type !== "cartes" ? `${LIBELLES[type]} : ${fiche.titre}` : LIBELLES[type],
    action:
      type === "cartes" ? { vue: "revision" } :
      type === "test" ? { vue: "chapitre", chapitre: fiche?.chapitre || "Sans chapitre" } :
      { vue: "fiche", ficheId: fiche.id, tab: { relire: "resume", qcm: "qcm", sujet: "sujet" }[type] },
  };
  c.extras = c.extras || {};
  (c.extras[date] ||= []).push(tache);
  saveControle(c);
}
export function retirerTache(c, id) {
  const date = id.split("|")[0];
  if (c.extras?.[date]?.some((t) => t.id === id)) c.extras[date] = c.extras[date].filter((t) => t.id !== id);
  else (c.retires ||= {})[id] = true;
  delete c.faits[id];
  saveControle(c);
}
export function planning(c) {
  return planningDeBase(c).map((j) => ({
    date: j.date,
    taches: [...j.taches.filter((t) => !c.retires?.[t.id]), ...(c.extras?.[j.date] || [])],
  }));
}
/** Change la date, les chapitres ou la précision d'un contrôle (les rappels sont reprogrammés par l'appelant). */
export function modifierControle(c, { date, chapitres, titre }) {
  if (date) c.date = date;
  if (chapitres) c.chapitres = chapitres;
  if (titre !== undefined) c.titre = titre;
  saveControle(c);
  return c;
}
export const fichesDuControle = fichesDu;

/** Tâches du jour et combien sont faites. */
export function duJour(c) {
  const p = planning(c).find((j) => j.date === aujourdhui());
  const taches = p?.taches || [];
  return { taches, faites: taches.filter((x) => c.faits[x.id]).length };
}
export function cocher(c, idTache, fait = true) {
  if (fait) c.faits[idTache] = true;
  else delete c.faits[idTache];
  saveControle(c);
}

// ---------- Rappels (notifications locales, sur le téléphone seulement) ----------
const idRappel = (c, k) => {
  let h = 0;
  for (const ch of c.id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return (Math.abs(h) % 100000) * 100 + k; // un identifiant entier stable par contrôle et par jour
};
async function plugin() {
  if (!Capacitor.isNativePlatform()) return null;
  return (await import("@capacitor/local-notifications")).LocalNotifications;
}
export async function annulerRappels(c) {
  const LN = await plugin();
  if (!LN || !c?.rappels?.length) return;
  await LN.cancel({ notifications: c.rappels.map((id) => ({ id })) }).catch(() => {});
}
/** Programme un rappel à 18 h chaque jour jusqu'au contrôle. Renvoie false si refusé ou indisponible. */
export async function programmerRappels(c, nomMatiere) {
  const LN = await plugin();
  if (!LN) return false;
  let perm = await LN.checkPermissions();
  if (perm.display !== "granted") perm = await LN.requestPermissions();
  if (perm.display !== "granted") return false;
  await annulerRappels(c);
  const maintenant = Date.now();
  const notifs = planning(c)
    .map((jour, k) => {
      const at = versDate(jour.date);
      at.setHours(HEURE_RAPPEL, 0, 0, 0);
      const r = Math.round((versDate(c.date) - versDate(jour.date)) / JOUR);
      return {
        id: idRappel(c, k),
        title: r <= 1 ? `📅 Contrôle de ${nomMatiere} demain !` : `📅 Contrôle de ${nomMatiere} dans ${r} jours`,
        body: `Aujourd'hui : ${jour.taches.slice(0, 2).map((x) => x.label).join(" · ")}${jour.taches.length > 2 ? "…" : ""}`,
        schedule: { at, allowWhileIdle: true },
        isExactNotification: false, // pas d'alarme exacte : Android ne demande aucune autorisation spéciale
      };
    })
    .filter((n) => n.schedule.at.getTime() > maintenant);
  if (notifs.length) await LN.schedule({ notifications: notifs });
  c.rappels = notifs.map((n) => n.id);
  saveControle(c);
  return true;
}
