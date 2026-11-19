// Données de l'appli, gardées sur le téléphone (localStorage).
const KEY_SETTINGS = "revizz.settings";
const KEY_FICHES = "revizz.fiches";
const KEY_STATS = "revizz.stats";

// Copie en mémoire : l'appli fonctionne même si le stockage du navigateur est bloqué.
const memoire = {};
function read(key, fallback) {
  try {
    const v = localStorage.getItem(key) ?? memoire[key];
    return v ? JSON.parse(v) : fallback;
  } catch {
    return memoire[key] ? JSON.parse(memoire[key]) : fallback;
  }
}
function write(key, value) {
  memoire[key] = JSON.stringify(value);
  try {
    localStorage.setItem(key, memoire[key]);
  } catch (e) {
    if (e?.name !== "QuotaExceededError") return; // stockage bloqué : on garde la copie en mémoire
    console.warn("Révizz : impossible d'enregistrer", e);
    throw new Error("Mémoire du téléphone pleine pour Révizz : supprime quelques anciennes fiches.");
  }
}

const DEFAULT_SETTINGS = { apiKey: "", prenom: "", classe: "Seconde", model: "claude-opus-5-5", demo: false };
export const getSettings = () => ({ ...DEFAULT_SETTINGS, ...read(KEY_SETTINGS, {}) });
export const saveSettings = (s) => write(KEY_SETTINGS, { ...getSettings(), ...s });

export const getFiches = () => read(KEY_FICHES, []);
export const getFiche = (id) => getFiches().find((f) => f.id === id);
export function saveFiche(fiche) {
  const all = getFiches();
  const i = all.findIndex((f) => f.id === fiche.id);
  if (i >= 0) all[i] = fiche;
  else all.unshift(fiche);
  write(KEY_FICHES, all);
}
export const deleteFiche = (id) => write(KEY_FICHES, getFiches().filter((f) => f.id !== id));

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------- Répétition espacée (boîtes de Leitner) ----------
// Boîte 0 = à revoir tout de suite ; plus la carte est sue, plus elle revient tard.
const INTERVALLES_JOURS = [0, 1, 3, 7, 15, 30];
const DAY = 24 * 3600 * 1000;

export function nouvelleCarte(c) {
  return { id: uid(), recto: c.recto, verso: c.verso, boite: 0, prochaine: 0 };
}
export function noterCarte(carte, sue) {
  carte.boite = sue ? Math.min(carte.boite + 1, INTERVALLES_JOURS.length - 1) : 0;
  carte.prochaine = Date.now() + INTERVALLES_JOURS[carte.boite] * DAY - 3600 * 1000;
  return carte;
}
export const estDue = (carte) => (carte.prochaine || 0) <= Date.now();
export const cartesDues = (fiche) => fiche.flashcards.filter(estDue);
export const maitrise = (fiche) =>
  fiche.flashcards.length
    ? Math.round((fiche.flashcards.reduce((s, c) => s + c.boite, 0) / (fiche.flashcards.length * (INTERVALLES_JOURS.length - 1))) * 100)
    : 0;

// ---------- Série de jours de révision ----------
const today = () => new Date().toISOString().slice(0, 10);
export function getStats() {
  const s = read(KEY_STATS, { serie: 0, dernierJour: null, cartesRevisees: 0, qcmFaits: 0 });
  const hier = new Date(Date.now() - DAY).toISOString().slice(0, 10);
  if (s.dernierJour && s.dernierJour !== today() && s.dernierJour !== hier) s.serie = 0;
  return s;
}
export function enregistrerActivite(type) {
  const s = getStats();
  if (s.dernierJour !== today()) {
    s.serie += 1;
    s.dernierJour = today();
  }
  if (type === "carte") s.cartesRevisees += 1;
  if (type === "qcm") s.qcmFaits += 1;
  write(KEY_STATS, s);
}

// ---------- Consommation de tokens (transparence éco-conception) ----------
const KEY_CONSO = "revizz.conso";
export const getConso = () => read(KEY_CONSO, { appels: 0, entree: 0, cache: 0, sortie: 0 });
export function enregistrerConso(usage) {
  if (!usage) return;
  const c = getConso();
  c.appels += 1;
  c.entree += (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
  c.cache += usage.cache_read_input_tokens || 0;
  c.sortie += usage.output_tokens || 0;
  write(KEY_CONSO, c);
}
export const resetConso = () => write(KEY_CONSO, { appels: 0, entree: 0, cache: 0, sortie: 0 });

// Accès génériques (utilisés par matieres.js)
export const lire = read;
export const ecrire = write;

// ---------- Progrès par chapitre : test de départ et test final ----------
// { "Matière|Chapitre": { depart: {date, score, total, questions}, finals: [{date, score, total}], demo? } }
const KEY_PROGRES = "revizz.progres";
const cle = (matiere, chapitre) => `${matiere}|${chapitre || "Sans chapitre"}`;
export const getProgres = (matiere, chapitre) => read(KEY_PROGRES, {})[cle(matiere, chapitre)] || { finals: [] };
export function saveProgres(matiere, chapitre, data) {
  const all = read(KEY_PROGRES, {});
  all[cle(matiere, chapitre)] = data;
  write(KEY_PROGRES, all);
}
// Quand un chapitre est renommé ou change de matière, ses résultats le suivent.
export function deplacerProgres(ancienneMatiere, ancienChapitre, matiere, chapitre) {
  const all = read(KEY_PROGRES, {});
  const a = cle(ancienneMatiere, ancienChapitre);
  const b = cle(matiere, chapitre);
  if (a === b || !all[a] || all[b]) return;
  all[b] = all[a];
  delete all[a];
  write(KEY_PROGRES, all);
}
export function supprimerProgresDemo() {
  const all = read(KEY_PROGRES, {});
  for (const k in all) if (all[k].demo) delete all[k];
  write(KEY_PROGRES, all);
}
/** Note sur 20, arrondie. */
export const sur20 = (score, total) => (total ? Math.round((score / total) * 20) : 0);
