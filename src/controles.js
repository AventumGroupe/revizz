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
 * - Tous les jours : les cartes à revoir de la matière.
 * - D'abord on relit chaque fiche, ensuite un QCM par fiche, répartis sur les jours.
 * - La veille : un sujet d'entraînement type contrôle et la relecture des points clés.
 * - Le jour J (ou si le contrôle est aujourd'hui) : relecture rapide et cartes.
 */
export function planning(c) {
  const fiches = fichesDu(c);
  const reste = joursRestants(c);
  if (reste < 0) return [];
  const t = (date, type, f, label, action) => ({ id: `${date}|${type}|${f?.id || "tout"}`, type, label, action });
  const jours = [];
  for (let k = 0; k < Math.max(reste, 1); k++) jours.push(iso(versDate(aujourdhui()).getTime() + k * JOUR));
  const n = jours.length;
  const plan = jours.map((date) => ({ date, taches: [] }));

  if (reste === 0) {
    // Contrôle aujourd'hui : l'essentiel.
    const d = plan[0].date;
    for (const f of fiches) plan[0].taches.push(t(d, "relire", f, `Relire les points clés : ${f.titre}`, { vue: "fiche", ficheId: f.id, tab: "resume" }));
    plan[0].taches.push(t(d, "cartes", null, "Cartes à revoir (5 min)", { vue: "revision" }));
    return plan;
  }

  // Lectures puis QCM, répartis sur les jours avant la veille (ou sur le seul jour disponible).
  const sequence = [
    ...fiches.map((f) => ({ type: "relire", f, label: `Relire la fiche : ${f.titre}`, action: { vue: "fiche", ficheId: f.id, tab: "resume" } })),
    ...fiches.map((f) => ({ type: "qcm", f, label: `QCM : ${f.titre}`, action: { vue: "fiche", ficheId: f.id, tab: "qcm" } })),
  ];
  const joursTravail = n > 1 ? n - 1 : 1;
  sequence.forEach((s, i) => {
    const k = Math.min(joursTravail - 1, Math.floor((i * joursTravail) / Math.max(sequence.length, 1)));
    plan[k].taches.push(t(plan[k].date, s.type, s.f, s.label, s.action));
  });
  plan.forEach((p) => p.taches.push(t(p.date, "cartes", null, "Réviser les cartes à revoir", { vue: "revision" })));
  // La veille : sujet blanc + relecture globale.
  const veille = plan[n - 1];
  if (fiches.length) {
    veille.taches.push(t(veille.date, "sujet", fiches[0], "Sujet d'entraînement type contrôle", { vue: "fiche", ficheId: fiches[0].id, tab: "sujet" }));
    if (n > 1) veille.taches.push(t(veille.date, "points", null, "Relire les points clés de toutes les fiches", { vue: "matiere" }));
  }
  return plan;
}

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
